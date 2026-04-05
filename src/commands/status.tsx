import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text, useApp } from 'ink'
import { formatDistanceToNow } from 'date-fns'
import { getToken, getApiUrl } from '../lib/config.js'
import { gql } from '../lib/client.js'
import { Spinner } from '../components/Spinner.js'
import { AccountCard } from '../components/AccountCard.js'
import type { Account } from '../components/AccountCard.js'

export const options = zod.object({
  watch: zod.boolean().default(false).describe('Poll and refresh every 2 seconds'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
})

type Props = { options: zod.infer<typeof options> }

interface QueueCounts { queued: number; running: number }

interface DimensionUsage { used: number; limit: number | null; atLimit: boolean }
interface SuggestionRefreshUsage { used: number; limit: number | null; atLimit: boolean; resetsAt: string | null }
interface Usage {
  plan: string
  interests: DimensionUsage
  apiKeys: DimensionUsage
  bookmarksEnabled: boolean
  socialGraphDegrees: number
  socialGraphMaxUsers: number | null
  suggestionRefreshes: SuggestionRefreshUsage
}

interface SuggestionCounts {
  inbox: number; later: number; replied: number
  read: number; skipped: number; archived: number; total: number
}

interface StatusData {
  me: Account
  queues: Record<string, QueueCounts>
  usage: Usage | null
  suggestionCounts: SuggestionCounts
}

const POLL_INTERVAL = 2000

const QUEUE_LABELS: Record<string, string> = {
  tweets: 'Tweets',
  bookmarks: 'Bookmarks',
  social_graph: 'Social graph',
  suggestions: 'Suggestions',
}

const GQL_QUERY = `
  query Status {
    me {
      accountId email xHandle xid isPayingCustomer
      indexingAccounts indexedTweets pendingEmbeddings
      twitterIndexedAt refreshedSuggestionsAt
    }
    suggestionCounts {
      inbox later replied read skipped archived total
    }
    usage {
      plan
      interests { used limit atLimit }
      apiKeys { used limit atLimit }
      bookmarksEnabled
      socialGraphDegrees
      socialGraphMaxUsers
      suggestionRefreshes { used limit atLimit resetsAt }
    }
  }
`

export default function Status({ options: flags }: Props) {
  const { exit } = useApp()
  const [data, setData] = useState<StatusData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = getToken()
    const baseUrl = getApiUrl().replace(/\/graphql$/, '')

    async function fetchStatus() {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10_000)
      try {
        const [statusRes, gqlRes] = await Promise.all([
          fetch(`${baseUrl}/indexing/status`, {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          }),
          gql<{ me: Account; usage: Usage | null; suggestionCounts: SuggestionCounts }>(GQL_QUERY),
        ])
        clearTimeout(timer)
        if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status} from ${baseUrl}`)
        const status = await statusRes.json()

        if (flags.json) {
          process.stdout.write(JSON.stringify({ ...gqlRes, queues: status.queues }, null, 2) + '\n')
          process.exit(0)
        }

        setData({ me: gqlRes.me, queues: status.queues, usage: gqlRes.usage, suggestionCounts: gqlRes.suggestionCounts })
        setError(null)
      } catch (err) {
        clearTimeout(timer)
        if (err instanceof DOMException && err.name === 'AbortError') {
          setError('Status request timed out (10s). Check SONAR_API_URL or retry without --watch.')
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

  useEffect(() => { if (!flags.watch && data !== null) exit() }, [data])
  useEffect(() => { if (!flags.watch && error !== null) exit(new Error(error)) }, [error])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!data) return <Spinner label="Loading status..." />

  const { me, queues, usage, suggestionCounts } = data
  const entries = Object.entries(queues)
  const hasActivity = entries.length > 0 || me.pendingEmbeddings > 0

  return (
    <Box flexDirection="column" gap={1}>
      <AccountCard me={me} />

      {usage && (
        <Box flexDirection="column">
          <Text bold color="cyan">Plan</Text>
          <Text><Text dimColor>plan:       </Text><Text color={usage.plan === 'free' ? 'yellow' : 'green'}>{usage.plan}</Text></Text>
          <Text>
            <Text dimColor>interests:  </Text>
            <Text color={usage.interests.atLimit ? 'red' : undefined}>
              {usage.interests.used}{usage.interests.limit !== null ? `/${usage.interests.limit}` : ''}
            </Text>
          </Text>
          <Text>
            <Text dimColor>bookmarks:  </Text>
            {usage.bookmarksEnabled ? <Text color="green">enabled</Text> : <Text dimColor>upgrade to unlock</Text>}
          </Text>
          <Text>
            <Text dimColor>refreshes:  </Text>
            {usage.suggestionRefreshes.limit !== null ? (
              <>
                <Text color={usage.suggestionRefreshes.atLimit ? 'red' : undefined}>
                  {usage.suggestionRefreshes.used}/{usage.suggestionRefreshes.limit}
                </Text>
                {usage.suggestionRefreshes.resetsAt && (
                  <Text dimColor> (resets {formatDistanceToNow(new Date(usage.suggestionRefreshes.resetsAt), { addSuffix: true })})</Text>
                )}
              </>
            ) : (
              <Text color="green">unlimited</Text>
            )}
          </Text>
        </Box>
      )}

      <Box flexDirection="column">
        <Text bold color="cyan">Inbox</Text>
        <Text><Text dimColor>inbox:    </Text><Text color={suggestionCounts.inbox > 0 ? 'green' : undefined}>{suggestionCounts.inbox}</Text></Text>
        <Text><Text dimColor>later:    </Text>{suggestionCounts.later}</Text>
        <Text><Text dimColor>archived: </Text>{suggestionCounts.archived}</Text>
        <Text><Text dimColor>total:    </Text>{suggestionCounts.total}</Text>
      </Box>

      <Box flexDirection="column">
        <Text bold color="cyan">Queues</Text>
        {!hasActivity ? (
          <Text color="green">Idle  ·  run <Text color="cyan">sonar refresh</Text> to trigger pipeline</Text>
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
                <Text color={counts.running > 0 ? 'green' : 'white'}>{String(counts.running).padEnd(10)}</Text>
                <Text color={counts.queued > 0 ? 'yellow' : 'white'}>{counts.queued}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
