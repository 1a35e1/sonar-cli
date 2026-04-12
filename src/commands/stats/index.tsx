import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { existsSync } from 'node:fs'

import { DB_PATH, openDb } from '../../lib/db.js'
import { Spinner } from '../../components/Spinner.js'
import { hBar, sparkline, compactNumber } from '../../lib/plots.js'

type Props = {
  options: {
    json: boolean
  }
}

type StatsSummary = {
  counts: {
    tweets: number
    users: number
    suggestions: number
    bookmarks: number
    likes: number
    topics: number
  }
  suggestionsByStatus: Array<{ status: string; count: number }>
  topAuthors: Array<{ username: string; tweets: number }>
  topEngaged: Array<{ username: string; engagement: number }>
  dailySuggestions: Array<{ day: string; count: number }>
}

function collectStats(): StatsSummary | null {
  if (!existsSync(DB_PATH)) return null
  const db = openDb()

  const counts = {
    tweets: (db.get('SELECT COUNT(*) as n FROM tweets') as { n: number }).n,
    users: (db.get('SELECT COUNT(*) as n FROM users') as { n: number }).n,
    suggestions: (db.get('SELECT COUNT(*) as n FROM suggestions') as { n: number }).n,
    bookmarks: (db.get('SELECT COUNT(*) as n FROM bookmarks') as { n: number }).n,
    likes: (db.get('SELECT COUNT(*) as n FROM likes') as { n: number }).n,
    topics: (db.get('SELECT COUNT(*) as n FROM topics') as { n: number }).n,
  }

  const suggestionsByStatus = db.all(
    'SELECT status, COUNT(*) as count FROM suggestions GROUP BY status ORDER BY count DESC',
  ) as Array<{ status: string; count: number }>

  const topAuthors = db.all(`
    SELECT u.username, COUNT(t.id) as tweets
    FROM tweets t JOIN users u ON u.xid = t.xid
    WHERE u.username IS NOT NULL
    GROUP BY u.xid
    ORDER BY tweets DESC
    LIMIT 10
  `) as Array<{ username: string; tweets: number }>

  const topEngaged = db.all(`
    SELECT u.username,
           (SELECT COUNT(*) FROM bookmarks b JOIN tweets t2 ON t2.id = b.tweet_id WHERE t2.xid = u.xid) +
           (SELECT COUNT(*) FROM likes l JOIN tweets t2 ON t2.id = l.tweet_id WHERE t2.xid = u.xid) as engagement
    FROM users u
    WHERE u.username IS NOT NULL
    GROUP BY u.xid
    HAVING engagement > 0
    ORDER BY engagement DESC
    LIMIT 10
  `) as Array<{ username: string; engagement: number }>

  const dailySuggestions = db.all(`
    SELECT DATE(created_at) as day, COUNT(*) as count
    FROM suggestions
    WHERE created_at > date('now', '-30 days')
    GROUP BY day
    ORDER BY day
  `) as Array<{ day: string; count: number }>

  db.close()

  return { counts, suggestionsByStatus, topAuthors, topEngaged, dailySuggestions }
}

export default function Stats({ options: flags }: Props) {
  const [data, setData] = useState<StatsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stats = collectStats()
      if (!stats) {
        setError('No local data found. Run: sonar data pull')
        return
      }
      if (flags.json) {
        process.stdout.write(JSON.stringify(stats, null, 2) + '\n')
        process.exit(0)
      }
      setData(stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!data) return <Spinner label="Loading stats..." />

  const maxAuthor = Math.max(...data.topAuthors.map((a) => a.tweets), 1)
  const maxEngaged = Math.max(...data.topEngaged.map((a) => a.engagement), 1)
  const dailyValues = data.dailySuggestions.map((d) => d.count)

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text bold>Sonar Stats</Text>
        <Text dimColor> — local data snapshot</Text>
      </Box>

      {/* Counts row */}
      <Box gap={2} flexWrap="wrap">
        <Text><Text color="cyan">{compactNumber(data.counts.tweets)}</Text><Text dimColor> tweets</Text></Text>
        <Text><Text color="cyan">{compactNumber(data.counts.users)}</Text><Text dimColor> users</Text></Text>
        <Text><Text color="cyan">{compactNumber(data.counts.suggestions)}</Text><Text dimColor> suggestions</Text></Text>
        <Text><Text color="cyan">{compactNumber(data.counts.bookmarks)}</Text><Text dimColor> bookmarks</Text></Text>
        <Text><Text color="cyan">{compactNumber(data.counts.likes)}</Text><Text dimColor> likes</Text></Text>
        <Text><Text color="cyan">{data.counts.topics}</Text><Text dimColor> topics</Text></Text>
      </Box>

      {/* Suggestions by status */}
      {data.suggestionsByStatus.length > 0 && (
        <Box flexDirection="column">
          <Text bold>Suggestions by status</Text>
          {data.suggestionsByStatus.map((s) => (
            <Box key={s.status} gap={1}>
              <Text dimColor>{s.status.padEnd(10)}</Text>
              <Text color="cyan">{s.count}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Top authors */}
      {data.topAuthors.length > 0 && (
        <Box flexDirection="column">
          <Text bold>Top authors by tweet count</Text>
          {data.topAuthors.map((a) => (
            <Box key={a.username} gap={1}>
              <Text>{`@${a.username}`.padEnd(22)}</Text>
              <Text color="cyan">{hBar(a.tweets, maxAuthor, 25)}</Text>
              <Text dimColor>{a.tweets}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Top engaged */}
      {data.topEngaged.length > 0 && (
        <Box flexDirection="column">
          <Text bold>Most engaged authors (bookmarks + likes)</Text>
          {data.topEngaged.map((a) => (
            <Box key={a.username} gap={1}>
              <Text>{`@${a.username}`.padEnd(22)}</Text>
              <Text color="green">{hBar(a.engagement, maxEngaged, 25)}</Text>
              <Text dimColor>{a.engagement}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Sparkline */}
      {dailyValues.length > 0 && (
        <Box flexDirection="column">
          <Text bold>Suggestions over last 30 days</Text>
          <Box gap={1}>
            <Text color="yellow">{sparkline(dailyValues)}</Text>
            <Text dimColor>
              {data.dailySuggestions[0].day} → {data.dailySuggestions[data.dailySuggestions.length - 1].day}
            </Text>
          </Box>
        </Box>
      )}

      <Text dimColor>
        Run sonar stats &lt;subcommand&gt; for more: network | authors | engagement | timeline
      </Text>
    </Box>
  )
}
