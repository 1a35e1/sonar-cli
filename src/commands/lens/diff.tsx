import React, { useEffect, useState } from 'react'
import { Text } from 'ink'
import { openDb, hasEmbeddings } from '../../lib/db.js'
import { parseWindow } from '../../lib/time.js'
import { analyze } from '../../lib/ai.js'
import { getVendor } from '../../lib/config.js'
import { Spinner } from '../../components/Spinner.js'

type Props = {
  options: {
    window: string
    vendor?: string
    json: boolean
  }
}

const SYSTEM = `You are a narrative shift analyst. For each of the user's tracked topics, I'm showing you two sets of representative tweets: one from the PREVIOUS period and one from the RECENT period. Each set is the most representative content for that topic in that time window.

Analyze the shifts:
- **New narratives** — themes in the recent period that weren't present before
- **Fading narratives** — themes from the previous period that dropped off
- **Escalating** — themes present in both but gaining intensity or attention
- **Stable** — themes that stayed consistent (mention briefly)

Be specific — name the actual topics, projects, people, or events driving the shift. Don't just say "DeFi discussion increased." Say what changed and why it matters.`

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

/**
 * Parse the window string and return ISO timestamps for the midpoint split.
 * e.g. "3d" → full=3 days ago, mid=1.5 days ago
 */
function getWindowBounds(windowStr: string): { fullCutoff: string; midCutoff: string } {
  const m = windowStr.match(/^(\d+)\s*(h|d|w)$/i)
  if (!m) {
    const days = 3
    const now = Date.now()
    return {
      fullCutoff: new Date(now - days * 86400000).toISOString(),
      midCutoff: new Date(now - (days / 2) * 86400000).toISOString(),
    }
  }
  const n = Number(m[1])
  const unit = m[2].toLowerCase()
  const ms = unit === 'h' ? n * 3600000 : unit === 'w' ? n * 7 * 86400000 : n * 86400000
  const now = Date.now()
  return {
    fullCutoff: new Date(now - ms).toISOString(),
    midCutoff: new Date(now - ms / 2).toISOString(),
  }
}

export default function LensDiff({ options: flags }: Props) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      const vendor = getVendor(flags.vendor)
      const { fullCutoff, midCutoff } = getWindowBounds(flags.window)

      const db = openDb()

      if (!hasEmbeddings(db)) {
        db.close()
        process.stderr.write('Lens commands require a paid plan. Upgrade at https://sonar.8640p.info/account\n')
        process.exit(1)
      }

      const topicRows = db.all('SELECT topic_id, name, embedding FROM topic_embeddings') as { topic_id: string; name: string; embedding: Uint8Array }[]
      const topics = topicRows.map(r => ({
        name: r.name,
        embedding: new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4),
      }))

      // Load all tweets in the full window
      const allTweets = db.all(
        `SELECT t.id as tweet_id, t.text, t.like_count, t.created_at,
                u.username, u.name as author_name
         FROM tweets t
         JOIN users u ON t.xid = u.xid
         WHERE t.created_at >= ?
           AND t.like_count >= 1
           AND length(t.text) >= 50
         ORDER BY t.created_at DESC`,
        [fullCutoff]
      ) as Record<string, unknown>[]

      // Load embeddings
      const embRows = db.all('SELECT tweet_id, embedding FROM tweet_embeddings') as { tweet_id: string; embedding: Uint8Array }[]
      const embMap = new Map<string, Float32Array>()
      for (const r of embRows) {
        embMap.set(r.tweet_id, new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4))
      }
      db.close()

      // Assign tweets to topics and split by time period
      type TweetWithEmb = { tweet: Record<string, unknown>; emb: Float32Array; topicSim: number }
      const prevByTopic = new Map<string, TweetWithEmb[]>()
      const recentByTopic = new Map<string, TweetWithEmb[]>()

      for (const tw of allTweets) {
        const emb = embMap.get(String(tw.tweet_id))
        if (!emb) continue

        let bestSim = 0
        let bestTopic = ''
        for (const t of topics) {
          const sim = cosineSim(emb, t.embedding)
          if (sim > bestSim) {
            bestSim = sim
            bestTopic = t.name
          }
        }
        if (bestSim < 0.25) continue

        const isRecent = String(tw.created_at) >= midCutoff
        const bucket = isRecent ? recentByTopic : prevByTopic
        if (!bucket.has(bestTopic)) bucket.set(bestTopic, [])
        bucket.get(bestTopic)!.push({ tweet: tw, emb, topicSim: bestSim })
      }

      // Build prompt: per topic, show top tweets from each period sorted by topic similarity
      const sections: string[] = []

      for (const topic of topics) {
        const prev = (prevByTopic.get(topic.name) || [])
          .sort((a, b) => b.topicSim - a.topicSim)
          .slice(0, 8)
        const recent = (recentByTopic.get(topic.name) || [])
          .sort((a, b) => b.topicSim - a.topicSim)
          .slice(0, 8)

        if (prev.length === 0 && recent.length === 0) continue

        const formatList = (items: TweetWithEmb[]) =>
          items.length === 0
            ? '  (no activity)'
            : items.map(i =>
                `  - @${i.tweet.username} (${i.tweet.like_count} likes): ${String(i.tweet.text).slice(0, 200)}`
              ).join('\n')

        sections.push([
          `=== ${topic.name} ===`,
          `PREVIOUS (${prev.length} relevant tweets):`,
          formatList(prev),
          ``,
          `RECENT (${recent.length} relevant tweets):`,
          formatList(recent),
        ].join('\n'))
      }

      if (sections.length === 0) {
        process.stderr.write('No data found in this window.\n')
        process.exit(0)
      }

      const result = await analyze(SYSTEM, sections.join('\n\n'), vendor)

      if (flags.json) {
        const prevTotal = [...prevByTopic.values()].reduce((s, a) => s + a.length, 0)
        const recentTotal = [...recentByTopic.values()].reduce((s, a) => s + a.length, 0)
        process.stdout.write(JSON.stringify({ analysis: result, previous: prevTotal, recent: recentTotal, topics: sections.length, window: flags.window }) + '\n')
      } else {
        process.stdout.write(result + '\n')
      }
      process.exit(0)
    }
    run().catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  return <Spinner label="Analyzing narrative shifts..." />
}
