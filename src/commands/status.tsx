import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text, useApp } from 'ink'
import { formatDistanceToNow } from 'date-fns'
import { getToken, getApiUrl } from '../lib/config.js'
import { gql } from '../lib/client.js'
import { Spinner } from '../components/Spinner.js'
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
  bookmarksEnabled: boolean
  suggestionRefreshes: SuggestionRefreshUsage
}

interface SuggestionCounts {
  inbox: number; later: number; archived: number; total: number
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
  default: 'Pipeline',
  topics: 'Topics',
}

const GQL_QUERY = `
  query Status {
    me {
      accountId email xHandle xid isPayingCustomer
      indexingAccounts indexedTweets pendingEmbeddings
      twitterIndexedAt refreshedSuggestionsAt
    }
    suggestionCounts {
      inbox later archived total
    }
    usage {
      plan
      interests { used limit atLimit }
      bookmarksEnabled
      suggestionRefreshes { used limit atLimit resetsAt }
    }
  }
`

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

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
        if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`)
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
          setError('Request timed out (10s)')
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
  if (!data) return <Spinner label="Loading..." />

  const { me, queues, usage, suggestionCounts } = data
  const entries = Object.entries(queues)
  const hasActivity = entries.length > 0 || me.pendingEmbeddings > 0

  const embedded = me.indexedTweets - me.pendingEmbeddings
  const embedPct = me.indexedTweets > 0 ? Math.round((embedded / me.indexedTweets) * 100) : 100

  return (
    <Box flexDirection="column" gap={1}>
      {/* Account */}
      <Box flexDirection="column">
        <Text bold>@{me.xHandle}</Text>
        <Text dimColor>
          {me.indexedTweets.toLocaleString()} tweets
          {' · '}indexed {timeAgo(me.twitterIndexedAt)}
          {' · '}refreshed {timeAgo(me.refreshedSuggestionsAt)}
        </Text>
      </Box>

      {/* Embeddings progress */}
      {me.pendingEmbeddings > 0 && (
        <Box flexDirection="column">
          <Text>
            <Text dimColor>embeddings: </Text>
            <Text color="yellow">{embedded.toLocaleString()}/{me.indexedTweets.toLocaleString()}</Text>
            <Text dimColor> ({embedPct}%)</Text>
          </Text>
        </Box>
      )}

      {/* Usage */}
      {usage && (
        <Box flexDirection="column">
          <Box gap={2}>
            <Text><Text dimColor>plan </Text><Text color={usage.plan === 'trial' ? 'yellow' : 'green'}>{usage.plan}</Text></Text>
            <Text dimColor>·</Text>
            <Text>
              <Text dimColor>topics </Text>
              <Text color={usage.interests.atLimit ? 'red' : undefined}>
                {usage.interests.used}{usage.interests.limit !== null ? `/${usage.interests.limit}` : ''}
              </Text>
            </Text>
            <Text dimColor>·</Text>
            <Text>
              <Text dimColor>refreshes </Text>
              {usage.suggestionRefreshes.limit !== null ? (
                <Text color={usage.suggestionRefreshes.atLimit ? 'red' : undefined}>
                  {usage.suggestionRefreshes.used}/{usage.suggestionRefreshes.limit}
                </Text>
              ) : (
                <Text color="green">unlimited</Text>
              )}
            </Text>
          </Box>
        </Box>
      )}

      {/* Inbox */}
      <Box gap={2}>
        <Text><Text dimColor>inbox </Text><Text color={suggestionCounts.inbox > 0 ? 'green' : undefined}>{suggestionCounts.inbox}</Text></Text>
        <Text><Text dimColor>later </Text>{suggestionCounts.later}</Text>
        <Text><Text dimColor>archived </Text>{suggestionCounts.archived}</Text>
      </Box>

      {/* Queues */}
      {hasActivity && (
        <Box flexDirection="column">
          <Text bold color="cyan">Queues</Text>
          {me.pendingEmbeddings > 0 && (
            <Text>
              <Text dimColor>{'  Embeddings'.padEnd(20)}</Text>
              <Text color="yellow">{me.pendingEmbeddings.toLocaleString()} pending</Text>
            </Text>
          )}
          {entries.map(([name, counts]) => (
            <Text key={name}>
              <Text dimColor>{'  ' + (QUEUE_LABELS[name] ?? name).padEnd(18)}</Text>
              {counts.running > 0 && <Text color="green">{counts.running} running  </Text>}
              {counts.queued > 0 && <Text color="yellow">{counts.queued} queued</Text>}
            </Text>
          ))}
        </Box>
      )}

      {!hasActivity && (
        <Text color="green">Idle · <Text color="cyan">sonar refresh</Text> to trigger pipeline</Text>
      )}
    </Box>
  )
}
