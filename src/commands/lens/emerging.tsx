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

// Candidate tweets from small accounts in the time window
const TWEETS_QUERY = `
  SELECT t.id as tweet_id, t.text, t.like_count, t.retweet_count,
         u.xid, u.username, u.name, u.description,
         u.followers_count, u.following_count
  FROM tweets t
  JOIN users u ON t.xid = u.xid
  WHERE t.created_at >= datetime('now', ?)
    AND u.followers_count BETWEEN 50 AND 15000
    AND t.like_count >= 1
  ORDER BY t.created_at DESC
`

const SYSTEM = `You are a social intelligence analyst. Given a set of small accounts whose tweets are semantically relevant to the user's topics and have outsized engagement relative to their follower count, identify which ones show genuine growing expertise versus noise.

For each noteworthy account (pick the top 5-8), explain:
- What domain they're gaining traction in
- What signals suggest rising credibility (specific content, not just metrics)
- Why they stand out from typical commentary

Skip accounts that are just resharing news or doing generic commentary. Be concise and specific.`

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

export default function LensEmerging({ options: flags }: Props) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      const modifier = parseWindow(flags.window)
      const vendor = getVendor(flags.vendor)
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

      // Load candidate tweets
      const tweets = db.all(TWEETS_QUERY, [modifier]) as Record<string, unknown>[]

      // Load tweet embeddings into a map
      const embRows = db.all('SELECT tweet_id, embedding FROM tweet_embeddings') as { tweet_id: string; embedding: Uint8Array }[]
      const embMap = new Map<string, Float32Array>()
      for (const r of embRows) {
        embMap.set(r.tweet_id, new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4))
      }
      db.close()

      // Score each tweet: max cosine similarity across topics
      const scored: { tweet: Record<string, unknown>; topicSim: number; topicName: string }[] = []
      for (const tw of tweets) {
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

        if (bestSim >= 0.3) {
          scored.push({ tweet: tw, topicSim: bestSim, topicName: bestTopic })
        }
      }

      // Group by author, compute engagement ratio
      const byAuthor = new Map<string, {
        username: string; name: string; description: string
        followers: number; following: number
        tweets: { text: string; likes: number; sim: number; topic: string }[]
        totalLikes: number
      }>()

      for (const { tweet: tw, topicSim, topicName } of scored) {
        const xid = String(tw.xid)
        if (!byAuthor.has(xid)) {
          byAuthor.set(xid, {
            username: String(tw.username),
            name: String(tw.name),
            description: String(tw.description || ''),
            followers: Number(tw.followers_count),
            following: Number(tw.following_count),
            tweets: [],
            totalLikes: 0,
          })
        }
        const author = byAuthor.get(xid)!
        author.tweets.push({
          text: String(tw.text).slice(0, 200),
          likes: Number(tw.like_count),
          sim: topicSim,
          topic: topicName,
        })
        author.totalLikes += Number(tw.like_count)
      }

      // Rank by engagement ratio (likes / followers)
      const ranked = [...byAuthor.values()]
        .map(a => ({ ...a, engagementRatio: a.totalLikes / Math.max(a.followers, 1) }))
        .sort((a, b) => b.engagementRatio - a.engagementRatio)
        .slice(0, 20)

      if (ranked.length === 0) {
        process.stderr.write('No emerging accounts found in this window.\n')
        process.exit(0)
      }

      const prompt = ranked.map((a) => [
        `@${a.username} (${a.name})`,
        `  Bio: ${a.description || '(none)'}`,
        `  Followers: ${a.followers} | Following: ${a.following}`,
        `  Relevant tweets: ${a.tweets.length} | Total likes: ${a.totalLikes} | Engagement ratio: ${a.engagementRatio.toFixed(2)}`,
        `  Top tweets:`,
        ...a.tweets
          .sort((x, y) => y.sim - x.sim)
          .slice(0, 3)
          .map(t => `    - [${t.topic}, sim=${t.sim.toFixed(2)}, ${t.likes} likes] ${t.text}`),
      ].join('\n')).join('\n\n')

      const result = await analyze(SYSTEM, prompt, vendor)

      if (flags.json) {
        process.stdout.write(JSON.stringify({ analysis: result, accounts: ranked.length, window: flags.window }) + '\n')
      } else {
        process.stdout.write(result + '\n')
      }
      process.exit(0)
    }
    run().catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  return <Spinner label="Analyzing emerging accounts..." />
}
