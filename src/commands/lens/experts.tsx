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

const TWEETS_QUERY = `
  SELECT t.id as tweet_id, t.text, t.like_count, t.retweet_count,
         u.xid, u.username, u.name, u.description,
         u.followers_count, u.following_count
  FROM tweets t
  JOIN users u ON t.xid = u.xid
  WHERE t.created_at >= datetime('now', ?)
    AND t.like_count >= 1
    AND length(t.text) >= 80
  ORDER BY t.created_at DESC
`

const SYSTEM = `You are an expertise classifier. For each topic, I'm showing you authors who consistently post high-relevance content in that domain — not one-off viral tweets, but repeated topical depth.

For each topic, identify the top 2-3 genuine domain experts. For each:
- What specific expertise they demonstrate (cite their actual tweets)
- Whether they show original analysis, first-hand experience, or technical depth
- What separates them from performative commentary or news resharing

Skip authors who are just promotional accounts or news aggregators, even if they post frequently about the topic. Focus on individuals demonstrating real knowledge.`

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

export default function LensExperts({ options: flags }: Props) {
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

      // Load tweets
      const tweets = db.all(TWEETS_QUERY, [modifier]) as Record<string, unknown>[]

      // Load embeddings
      const embRows = db.all('SELECT tweet_id, embedding FROM tweet_embeddings') as { tweet_id: string; embedding: Uint8Array }[]
      const embMap = new Map<string, Float32Array>()
      for (const r of embRows) {
        embMap.set(r.tweet_id, new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4))
      }
      db.close()

      // Assign tweets to best topic, group by author per topic
      type AuthorProfile = {
        username: string; name: string; description: string
        followers: number; following: number
        tweets: { text: string; likes: number; sim: number }[]
        avgSim: number; totalLikes: number
      }
      const topicAuthors = new Map<string, Map<string, AuthorProfile>>()

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
        if (bestSim < 0.3) continue

        if (!topicAuthors.has(bestTopic)) topicAuthors.set(bestTopic, new Map())
        const authors = topicAuthors.get(bestTopic)!
        const xid = String(tw.xid)

        if (!authors.has(xid)) {
          authors.set(xid, {
            username: String(tw.username),
            name: String(tw.name),
            description: String(tw.description || ''),
            followers: Number(tw.followers_count),
            following: Number(tw.following_count),
            tweets: [],
            avgSim: 0,
            totalLikes: 0,
          })
        }
        const author = authors.get(xid)!
        author.tweets.push({
          text: String(tw.text).slice(0, 250),
          likes: Number(tw.like_count),
          sim: bestSim,
        })
        author.totalLikes += Number(tw.like_count)
      }

      // Build prompt: per topic, rank authors by consistency (avg similarity × tweet count)
      const sections: string[] = []

      for (const topic of topics) {
        const authors = topicAuthors.get(topic.name)
        if (!authors || authors.size === 0) continue

        // Score: avg similarity × log(tweet count + 1) — rewards consistent depth
        const ranked = [...authors.values()]
          .filter(a => a.tweets.length >= 2) // need at least 2 tweets to show consistency
          .map(a => {
            a.avgSim = a.tweets.reduce((s, t) => s + t.sim, 0) / a.tweets.length
            return { ...a, expertScore: a.avgSim * Math.log2(a.tweets.length + 1) }
          })
          .sort((a, b) => b.expertScore - a.expertScore)
          .slice(0, 8)

        if (ranked.length === 0) continue

        const authorList = ranked.map(a => [
          `@${a.username} (${a.name}) — ${a.followers} followers`,
          `  Bio: ${a.description || '(none)'}`,
          `  Topical tweets: ${a.tweets.length} | Avg similarity: ${a.avgSim.toFixed(3)} | Total likes: ${a.totalLikes}`,
          `  Best tweets:`,
          ...a.tweets
            .sort((x, y) => y.sim - x.sim)
            .slice(0, 3)
            .map(t => `    - [sim=${t.sim.toFixed(2)}, ${t.likes} likes] ${t.text}`),
        ].join('\n')).join('\n\n')

        sections.push(`=== ${topic.name} ===\n${authorList}`)
      }

      if (sections.length === 0) {
        process.stderr.write('Not enough data to identify experts in this window.\n')
        process.exit(0)
      }

      const result = await analyze(SYSTEM, sections.join('\n\n'), vendor)

      if (flags.json) {
        process.stdout.write(JSON.stringify({ analysis: result, topics: sections.length, window: flags.window }) + '\n')
      } else {
        process.stdout.write(result + '\n')
      }
      process.exit(0)
    }
    run().catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  return <Spinner label="Identifying domain experts..." />
}
