import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { existsSync } from 'node:fs'

import { DB_PATH, openDb } from '../../lib/db.js'
import { Spinner } from '../../components/Spinner.js'
import { hBar, sparkline } from '../../lib/plots.js'

type Props = {
  options: { json: boolean }
}

type Data = {
  totalBookmarks: number
  totalLikes: number
  topBookmarked: Array<{ username: string; count: number }>
  topLiked: Array<{ username: string; count: number }>
  bookmarksByDay: Array<{ day: string; count: number }>
  likesByDay: Array<{ day: string; count: number }>
}

function collect(): Data | null {
  if (!existsSync(DB_PATH)) return null
  const db = openDb()

  const totalBookmarks = (db.get('SELECT COUNT(*) as n FROM bookmarks') as { n: number }).n
  const totalLikes = (db.get('SELECT COUNT(*) as n FROM likes') as { n: number }).n

  const topBookmarked = db.all(`
    SELECT u.username, COUNT(b.tweet_id) as count
    FROM bookmarks b
    JOIN tweets t ON t.id = b.tweet_id
    JOIN users u ON u.xid = t.xid
    WHERE u.username IS NOT NULL
    GROUP BY u.xid
    ORDER BY count DESC
    LIMIT 10
  `) as Array<{ username: string; count: number }>

  const topLiked = db.all(`
    SELECT u.username, COUNT(l.tweet_id) as count
    FROM likes l
    JOIN tweets t ON t.id = l.tweet_id
    JOIN users u ON u.xid = t.xid
    WHERE u.username IS NOT NULL
    GROUP BY u.xid
    ORDER BY count DESC
    LIMIT 10
  `) as Array<{ username: string; count: number }>

  const bookmarksByDay = db.all(`
    SELECT DATE(indexed_at) as day, COUNT(*) as count
    FROM bookmarks
    WHERE indexed_at > date('now', '-30 days')
    GROUP BY day ORDER BY day
  `) as Array<{ day: string; count: number }>

  const likesByDay = db.all(`
    SELECT DATE(indexed_at) as day, COUNT(*) as count
    FROM likes
    WHERE indexed_at > date('now', '-30 days')
    GROUP BY day ORDER BY day
  `) as Array<{ day: string; count: number }>

  db.close()

  return { totalBookmarks, totalLikes, topBookmarked, topLiked, bookmarksByDay, likesByDay }
}

export default function StatsEngagement({ options: flags }: Props) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const d = collect()
      if (!d) {
        setError('No local data found. Run: sonar data pull')
        return
      }
      if (flags.json) {
        process.stdout.write(JSON.stringify(d, null, 2) + '\n')
        process.exit(0)
      }
      setData(d)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!data) return <Spinner label="Loading engagement..." />

  const maxB = Math.max(...data.topBookmarked.map((a) => a.count), 1)
  const maxL = Math.max(...data.topLiked.map((a) => a.count), 1)

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Engagement</Text>

      <Box gap={3}>
        <Text><Text color="cyan">{data.totalBookmarks}</Text><Text dimColor> bookmarks</Text></Text>
        <Text><Text color="cyan">{data.totalLikes}</Text><Text dimColor> likes</Text></Text>
      </Box>

      {data.topBookmarked.length > 0 && (
        <Box flexDirection="column">
          <Text bold>Most bookmarked authors</Text>
          {data.topBookmarked.map((a) => (
            <Box key={a.username} gap={1}>
              <Text>{`@${a.username}`.padEnd(22)}</Text>
              <Text color="yellow">{hBar(a.count, maxB, 25)}</Text>
              <Text dimColor>{a.count}</Text>
            </Box>
          ))}
        </Box>
      )}

      {data.topLiked.length > 0 && (
        <Box flexDirection="column">
          <Text bold>Most liked authors</Text>
          {data.topLiked.map((a) => (
            <Box key={a.username} gap={1}>
              <Text>{`@${a.username}`.padEnd(22)}</Text>
              <Text color="red">{hBar(a.count, maxL, 25)}</Text>
              <Text dimColor>{a.count}</Text>
            </Box>
          ))}
        </Box>
      )}

      <Box flexDirection="column">
        <Text bold>Activity over last 30 days</Text>
        {data.bookmarksByDay.length > 0 && (
          <Box gap={1}>
            <Text dimColor>bookmarks</Text>
            <Text color="yellow">{sparkline(data.bookmarksByDay.map((d) => d.count))}</Text>
          </Box>
        )}
        {data.likesByDay.length > 0 && (
          <Box gap={1}>
            <Text dimColor>likes    </Text>
            <Text color="red">{sparkline(data.likesByDay.map((d) => d.count))}</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}
