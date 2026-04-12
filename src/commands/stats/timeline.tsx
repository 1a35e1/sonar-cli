import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { existsSync } from 'node:fs'

import { DB_PATH, openDb } from '../../lib/db.js'
import { Spinner } from '../../components/Spinner.js'
import { hBar, sparkline } from '../../lib/plots.js'

type Props = {
  options: { json: boolean; days: number }
}

type Row = { day: string; count: number }

type Data = {
  suggestions: Row[]
  bookmarks: Row[]
  likes: Row[]
}

function collect(days: number): Data | null {
  if (!existsSync(DB_PATH)) return null
  const db = openDb()
  const since = `date('now', '-${days} days')`

  const suggestions = db.all(`
    SELECT DATE(created_at) as day, COUNT(*) as count
    FROM suggestions WHERE created_at > ${since}
    GROUP BY day ORDER BY day
  `) as Row[]
  const bookmarks = db.all(`
    SELECT DATE(indexed_at) as day, COUNT(*) as count
    FROM bookmarks WHERE indexed_at > ${since}
    GROUP BY day ORDER BY day
  `) as Row[]
  const likes = db.all(`
    SELECT DATE(indexed_at) as day, COUNT(*) as count
    FROM likes WHERE indexed_at > ${since}
    GROUP BY day ORDER BY day
  `) as Row[]

  db.close()
  return { suggestions, bookmarks, likes }
}

export default function StatsTimeline({ options: flags }: Props) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const days = flags.days || 30

  useEffect(() => {
    try {
      const d = collect(days)
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
  if (!data) return <Spinner label="Loading timeline..." />

  const renderSeries = (label: string, rows: Row[], color: string) => {
    if (rows.length === 0) return null
    const values = rows.map((r) => r.count)
    const max = Math.max(...values)
    const total = values.reduce((a, b) => a + b, 0)
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box gap={2}>
          <Text bold>{label}</Text>
          <Text dimColor>total: {total} · max/day: {max}</Text>
        </Box>
        <Text color={color}>{sparkline(values)}</Text>
        <Box flexDirection="column" marginTop={1}>
          {rows.slice(-10).map((r) => (
            <Box key={r.day} gap={1}>
              <Text dimColor>{r.day}</Text>
              <Text color={color}>{hBar(r.count, max, 25)}</Text>
              <Text dimColor>{r.count}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text bold>Timeline</Text>
        <Text dimColor> — last {days} days</Text>
      </Box>
      {renderSeries('Suggestions', data.suggestions, 'cyan')}
      {renderSeries('Bookmarks', data.bookmarks, 'yellow')}
      {renderSeries('Likes', data.likes, 'red')}
    </Box>
  )
}
