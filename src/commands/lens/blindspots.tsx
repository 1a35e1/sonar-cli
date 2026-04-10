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
  SELECT u.username, u.name, t.text, t.like_count, t.retweet_count
  FROM tweets t
  JOIN users u ON t.xid = u.xid
  LEFT JOIN suggestions s ON s.tweet_id = t.id
  WHERE s.id IS NULL
    AND t.created_at >= datetime('now', ?)
    AND (t.like_count + t.retweet_count) >= 5
  ORDER BY (t.like_count + t.retweet_count) DESC
  LIMIT 30
`

const TOPICS_QUERY = `SELECT name, description FROM topics`

const SYSTEM = `You are a blind-spot analyst for a social intelligence tool. Given the user's tracked topics and tweets their suggestion algorithm missed (but that had decent engagement), identify important conversations they're not seeing. What themes or discussions are underrepresented? What should they add to their topics to close these gaps? Be specific and actionable.`

export default function LensBlindspot({ options: flags }: Props) {
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
      const tweets = db.all(TWEETS_QUERY, [modifier]) as Record<string, unknown>[]
      const topics = db.all(TOPICS_QUERY) as Record<string, unknown>[]
      db.close()

      if (tweets.length === 0) {
        process.stderr.write('No missed tweets found in this window.\n')
        process.exit(0)
      }

      const topicList = topics.length > 0
        ? topics.map((t) => `- ${t.name}: ${t.description || '(no description)'}`).join('\n')
        : '(no topics configured)'

      const tweetList = tweets.map((r) =>
        `@${r.username} (${r.name}): ${String(r.text).slice(0, 300)} [likes: ${r.like_count}, RTs: ${r.retweet_count}]`
      ).join('\n')

      const prompt = [
        '=== MY TOPICS ===',
        topicList,
        '',
        '=== MISSED TWEETS (not in suggestions, but engaged) ===',
        tweetList,
      ].join('\n')

      const result = await analyze(SYSTEM, prompt, vendor)

      if (flags.json) {
        process.stdout.write(JSON.stringify({ analysis: result, missed: tweets.length, topics: topics.length, window: flags.window }) + '\n')
      } else {
        process.stdout.write(result + '\n')
      }
      process.exit(0)
    }
    run().catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  return <Spinner label="Scanning for blind spots..." />
}
