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
         u.username, u.name, u.description, u.followers_count
  FROM tweets t
  JOIN users u ON t.xid = u.xid
  WHERE t.created_at >= datetime('now', ?)
    AND t.like_count >= 3
    AND length(t.text) >= 80
  ORDER BY t.created_at DESC
`

const SYSTEM = `You are a contrarian viewpoint analyst. I'm giving you two things per topic:

1. A summary of what the MAJORITY of tweets in that topic say (the consensus)
2. A set of OUTLIER tweets — semantically relevant to the topic but furthest from the consensus

Identify which outlier tweets represent genuine contrarian positions backed by reasoning, evidence, or domain expertise. Skip trolling, rage-bait, or empty provocation.

For each worthwhile contrarian take (pick 3-6 total across all topics):
- What consensus they're challenging
- Why their position is credible and worth considering
- What you'd miss if you only followed the crowd

Be concise and specific.`

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

function meanEmbedding(embeddings: Float32Array[]): Float32Array {
  const dim = embeddings[0].length
  const mean = new Float32Array(dim)
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) mean[i] += emb[i]
  }
  // Normalize
  let norm = 0
  for (let i = 0; i < dim; i++) {
    mean[i] /= embeddings.length
    norm += mean[i] * mean[i]
  }
  norm = Math.sqrt(norm)
  if (norm > 0) for (let i = 0; i < dim; i++) mean[i] /= norm
  return mean
}

export default function LensContrarian({ options: flags }: Props) {
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

      // For each topic: assign tweets, compute centroid, find outliers
      type ScoredTweet = { tweet: Record<string, unknown>; emb: Float32Array; topicSim: number }
      const topicGroups = new Map<string, ScoredTweet[]>()

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

        if (bestSim >= 0.25) {
          if (!topicGroups.has(bestTopic)) topicGroups.set(bestTopic, [])
          topicGroups.get(bestTopic)!.push({ tweet: tw, emb, topicSim: bestSim })
        }
      }

      // Build prompt: per topic, show consensus centroid description + outlier tweets
      const sections: string[] = []

      for (const [topicName, group] of topicGroups) {
        if (group.length < 5) continue // need enough tweets to establish consensus

        // Compute centroid of all tweets in this topic
        const centroid = meanEmbedding(group.map(g => g.emb))

        // Score each tweet by distance from centroid (lower = more consensus, higher = more contrarian)
        const withDist = group.map(g => ({
          ...g,
          centroidSim: cosineSim(g.emb, centroid),
        }))

        // Consensus: top 5 closest to centroid (what most people are saying)
        const consensus = withDist
          .sort((a, b) => b.centroidSim - a.centroidSim)
          .slice(0, 5)

        // Outliers: bottom tweets by centroid similarity, but still topically relevant
        const outliers = withDist
          .filter(t => t.topicSim >= 0.3) // still relevant to the topic
          .sort((a, b) => a.centroidSim - b.centroidSim)
          .slice(0, 8)

        if (outliers.length === 0) continue

        const consensusSummary = consensus.map(c =>
          `  - @${c.tweet.username}: ${String(c.tweet.text).slice(0, 150)}`
        ).join('\n')

        const outlierList = outliers.map(o =>
          `  - @${o.tweet.username} (${o.tweet.followers_count} followers, ${o.tweet.like_count} likes) [centroid_dist=${(1 - o.centroidSim).toFixed(3)}]: ${String(o.tweet.text).slice(0, 250)}`
        ).join('\n')

        sections.push([
          `=== TOPIC: ${topicName} (${group.length} tweets) ===`,
          `CONSENSUS (what most people say):`,
          consensusSummary,
          ``,
          `OUTLIERS (semantically distant from consensus):`,
          outlierList,
        ].join('\n'))
      }

      if (sections.length === 0) {
        process.stderr.write('Not enough data to identify contrarian viewpoints in this window.\n')
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
  return <Spinner label="Finding contrarian viewpoints..." />
}
