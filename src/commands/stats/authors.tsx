import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { existsSync } from 'node:fs'

import { DB_PATH, openDb } from '../../lib/db.js'
import { Spinner } from '../../components/Spinner.js'
import { hBar } from '../../lib/plots.js'

type Props = {
  options: { json: boolean; limit: number }
}

type Author = {
  username: string
  name: string | null
  tweets: number
  bookmarks: number
  likes: number
  total_likes: number
  followers: number
}

function collect(limit: number): Author[] | null {
  if (!existsSync(DB_PATH)) return null
  const db = openDb()
  const rows = db.all(`
    SELECT
      u.username,
      u.name,
      u.followers_count as followers,
      COUNT(DISTINCT t.id) as tweets,
      (SELECT COUNT(*) FROM bookmarks b JOIN tweets tb ON tb.id = b.tweet_id WHERE tb.xid = u.xid) as bookmarks,
      (SELECT COUNT(*) FROM likes l JOIN tweets tl ON tl.id = l.tweet_id WHERE tl.xid = u.xid) as likes,
      COALESCE(SUM(t.like_count), 0) as total_likes
    FROM users u
    LEFT JOIN tweets t ON t.xid = u.xid
    WHERE u.username IS NOT NULL
    GROUP BY u.xid
    HAVING tweets > 0
    ORDER BY tweets DESC
    LIMIT ?
  `, [limit]) as Author[]
  db.close()
  return rows
}

export default function StatsAuthors({ options: flags }: Props) {
  const [data, setData] = useState<Author[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const limit = flags.limit || 20

  useEffect(() => {
    try {
      const rows = collect(limit)
      if (!rows) {
        setError('No local data found. Run: sonar data pull')
        return
      }
      if (flags.json) {
        process.stdout.write(JSON.stringify(rows, null, 2) + '\n')
        process.exit(0)
      }
      setData(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!data) return <Spinner label="Loading authors..." />

  const maxTweets = Math.max(...data.map((a) => a.tweets), 1)

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text bold>Top Authors</Text>
        <Text dimColor> (by tweet count in your local data)</Text>
      </Box>

      <Box flexDirection="column">
        {data.map((a) => (
          <Box key={a.username} gap={1}>
            <Text>{`@${a.username}`.padEnd(22)}</Text>
            <Text color="cyan">{hBar(a.tweets, maxTweets, 25)}</Text>
            <Text dimColor>{String(a.tweets).padStart(4)}</Text>
            <Text dimColor>  b:{a.bookmarks} l:{a.likes}</Text>
          </Box>
        ))}
      </Box>

      <Text dimColor>b = bookmarked, l = liked</Text>
    </Box>
  )
}
