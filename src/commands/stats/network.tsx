import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { existsSync } from 'node:fs'

import { DB_PATH, openDb } from '../../lib/db.js'
import { Spinner } from '../../components/Spinner.js'
import { hBar, bucketize, compactNumber } from '../../lib/plots.js'

type Props = {
  options: { json: boolean }
}

type NetworkData = {
  totalUsers: number
  totalAuthors: number
  avgTweetsPerAuthor: number
  followersDistribution: number[]
  followersBuckets: { label: string; count: number }[]
}

function collect(): NetworkData | null {
  if (!existsSync(DB_PATH)) return null
  const db = openDb()

  const totalUsers = (db.get('SELECT COUNT(*) as n FROM users') as { n: number }).n
  const totalAuthors = (db.get(
    'SELECT COUNT(DISTINCT xid) as n FROM tweets WHERE xid IS NOT NULL',
  ) as { n: number }).n
  const tweetsPerAuthor = db.all(`
    SELECT COUNT(*) as n FROM tweets WHERE xid IS NOT NULL GROUP BY xid
  `) as Array<{ n: number }>
  const avgTweetsPerAuthor = tweetsPerAuthor.length
    ? tweetsPerAuthor.reduce((a, b) => a + b.n, 0) / tweetsPerAuthor.length
    : 0

  const followerCounts = (db.all(`
    SELECT followers_count as n FROM users WHERE followers_count IS NOT NULL AND followers_count > 0
  `) as Array<{ n: number }>).map((r) => r.n)

  // Log-scale buckets: 0-100, 100-1K, 1K-10K, 10K-100K, 100K+
  const followersBuckets = [
    { label: '< 100     ', count: followerCounts.filter((n) => n < 100).length },
    { label: '100 — 1K  ', count: followerCounts.filter((n) => n >= 100 && n < 1000).length },
    { label: '1K — 10K  ', count: followerCounts.filter((n) => n >= 1000 && n < 10000).length },
    { label: '10K — 100K', count: followerCounts.filter((n) => n >= 10000 && n < 100000).length },
    { label: '100K+     ', count: followerCounts.filter((n) => n >= 100000).length },
  ]

  db.close()

  return {
    totalUsers,
    totalAuthors,
    avgTweetsPerAuthor,
    followersDistribution: bucketize(followerCounts, 20),
    followersBuckets,
  }
}

export default function StatsNetwork({ options: flags }: Props) {
  const [data, setData] = useState<NetworkData | null>(null)
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
  if (!data) return <Spinner label="Loading network..." />

  const maxBucket = Math.max(...data.followersBuckets.map((b) => b.count), 1)

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Network</Text>

      <Box flexDirection="column">
        <Box gap={2}>
          <Text><Text color="cyan">{compactNumber(data.totalUsers)}</Text><Text dimColor> total users in DB</Text></Text>
        </Box>
        <Box gap={2}>
          <Text><Text color="cyan">{compactNumber(data.totalAuthors)}</Text><Text dimColor> authors with tweets</Text></Text>
        </Box>
        <Box gap={2}>
          <Text><Text color="cyan">{data.avgTweetsPerAuthor.toFixed(1)}</Text><Text dimColor> avg tweets per author</Text></Text>
        </Box>
      </Box>

      <Box flexDirection="column">
        <Text bold>Follower distribution</Text>
        {data.followersBuckets.map((b) => (
          <Box key={b.label} gap={1}>
            <Text dimColor>{b.label}</Text>
            <Text color="magenta">{hBar(b.count, maxBucket, 30)}</Text>
            <Text dimColor>{b.count}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
