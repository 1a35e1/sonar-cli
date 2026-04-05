import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text, useApp } from 'ink'
import { getToken, getApiUrl } from '../lib/config.js'
import { gql } from '../lib/client.js'
import { Spinner } from '../components/Spinner.js'
import { AccountCard } from '../components/AccountCard.js'
import type { Account } from '../components/AccountCard.js'

export const options = zod.object({
  watch: zod.boolean().default(false).describe('Poll and refresh every 2 seconds'),
})

type Props = { options: zod.infer<typeof options> }

interface QueueCounts {
  queued: number
  running: number
}

interface MonitorData {
  me: Account
  queues: Record<string, QueueCounts>
}

const POLL_INTERVAL = 2000

const QUEUE_LABELS: Record<string, string> = {
  tweets: 'Tweets',
  bookmarks: 'Bookmarks',
  social_graph: 'Social graph',
  suggestions: 'Suggestions',
}

export default function Monitor({ options: flags }: Props) {
  const { exit } = useApp()
  const [data, setData] = useState<MonitorData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = getToken()
    const baseUrl = getApiUrl().replace(/\/graphql$/, '')

    async function fetchStatus() {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10_000)
      try {
        const [statusRes, meRes] = await Promise.all([
          fetch(`${baseUrl}/indexing/status`, {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          }),
          gql<{ me: Account }>(`
            query MonitorStatus {
              me {
                accountId
                email
                xHandle
                xid
                isPayingCustomer
                indexingAccounts
                indexedTweets
                pendingEmbeddings
                twitterIndexedAt
                refreshedSuggestionsAt
              }
            }
          `),
        ])
        clearTimeout(timer)
        if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status} from ${baseUrl}`)
        const status = await statusRes.json()
        setData({ me: meRes.me, queues: status.queues })
        setError(null)
      } catch (err) {
        clearTimeout(timer)
        if (err instanceof DOMException && err.name === 'AbortError') {
          setError(
            'Monitor request timed out (10s). ' +
            'The server may be overloaded. ' +
            'Check SONAR_API_URL or retry without --watch.'
          )
        } else {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    fetchStatus()
    if (!flags.watch) return
    const timer = setInterval(fetchStatus, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!flags.watch && data !== null) exit()
  }, [data])

  useEffect(() => {
    if (!flags.watch && error !== null) exit(new Error(error))
  }, [error])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!data) return <Spinner label="Loading ingest status..." />

  const { me, queues } = data
  const entries = Object.entries(queues)
  const hasActivity = entries.length > 0 || me.pendingEmbeddings > 0

  return (
    <Box flexDirection="column" gap={1}>
      <AccountCard me={me} />
      <Box flexDirection="column">
        <Text bold color="cyan">Job Queues</Text>
        {!hasActivity ? (
          <>
          <Text color="green">No active ingest jobs.</Text>
          <Text color="green">Run <Text color="cyan">sonar interests match</Text> to start surface relevant tweets.</Text>
          </>
        ) : (
          <Box flexDirection="column" gap={0}>
            <Box gap={2} marginBottom={1}>
              <Text bold color="cyan">{('Queue').padEnd(16)}</Text>
              <Text bold color="cyan">{'Running'.padEnd(10)}</Text>
              <Text bold color="cyan">Queued</Text>
            </Box>
            {entries.map(([name, counts]) => (
              <Box key={name} gap={2}>
                <Text>{(QUEUE_LABELS[name] ?? name).padEnd(16)}</Text>
                <Text color={counts.running > 0 ? 'green' : 'white'}>
                  {String(counts.running).padEnd(10)}
                </Text>
                <Text color={counts.queued > 0 ? 'yellow' : 'white'}>
                  {counts.queued}
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
