import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text, useApp, useStdout } from 'ink'
import { Spinner } from '../components/Spinner.js'
import { HistoryBrowser } from '../components/HistoryBrowser.js'
import type { HistoryItem } from '../components/HistoryBrowser.js'
import { gql } from '../lib/client.js'
import { getFeedRender, getFeedWidth } from '../lib/config.js'
import { TweetCard, FeedTable } from '../components/TweetCard.js'
import type { FeedTweet } from '../components/TweetCard.js'

export const description = 'Browse previously triaged suggestions'

export const options = zod.object({
  status: zod
    .string()
    .optional()
    .describe('Filter by status: archived|saved|read|skipped|replied (default: all non-inbox)'),
  limit: zod.number().optional().describe('Result limit per page (default: 20)'),
  render: zod.string().optional().describe('Output layout: card|table'),
  width: zod.number().optional().describe('Card width in columns'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
  interactive: zod
    .boolean()
    .default(true)
    .describe('Interactive browser mode (default: on, use --no-interactive to disable)'),
})

type Props = { options: zod.infer<typeof options> }

// Matches the shape returned by the suggestions GraphQL query
interface SuggestionResponse {
  suggestionId: string
  score: number
  status: string
  tweet: HistoryItem['tweet']
}

const HISTORY_QUERY = `
  query History($status: SuggestionStatus, $limit: Int, $offset: Int) {
    suggestions(status: $status, limit: $limit, offset: $offset) {
      suggestionId score status
      tweet {
        id xid text createdAt likeCount retweetCount replyCount
        user { displayName username followersCount followingCount }
      }
    }
    suggestionCounts { archived later read skipped replied total inbox }
  }
`

const STATUS_MAP: Record<string, string> = {
  archived: 'ARCHIVED',
  saved: 'LATER',
  later: 'LATER',
  read: 'READ',
  skipped: 'SKIPPED',
  replied: 'REPLIED',
}

function resolveStatus(input?: string): string | undefined {
  if (!input) return undefined
  const key = input.toLowerCase()
  return STATUS_MAP[key] ?? input.toUpperCase()
}

function countForStatus(
  counts: { archived: number; later: number; read: number; skipped: number; replied: number; total: number; inbox: number },
  status?: string,
): number {
  if (!status) return counts.total - counts.inbox
  switch (status) {
    case 'ARCHIVED': return counts.archived
    case 'LATER': return counts.later
    case 'READ': return counts.read
    case 'SKIPPED': return counts.skipped
    case 'REPLIED': return counts.replied
    default: return counts.total - counts.inbox
  }
}

export default function History({ options: flags }: Props) {
  const { exit } = useApp()
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 100
  const cardWidth = getFeedWidth(flags.width)
  const render = getFeedRender(flags.render)
  const statusFilter = resolveStatus(flags.status)

  useEffect(() => {
    async function load() {
      try {
        const limit = flags.limit ?? 20
        const vars: Record<string, unknown> = { limit, offset: 0 }
        if (statusFilter) vars.status = statusFilter

        const res = await gql<{
          suggestions: SuggestionResponse[]
          suggestionCounts: {
            archived: number; later: number; read: number
            skipped: number; replied: number; total: number; inbox: number
          }
        }>(HISTORY_QUERY, vars)

        // When no status filter, exclude INBOX items from results
        const filtered = statusFilter
          ? res.suggestions
          : res.suggestions.filter(s => s.status !== 'INBOX')

        const historyTotal = countForStatus(res.suggestionCounts, statusFilter)

        const mapped: HistoryItem[] = filtered.map(s => ({
          key: s.tweet.xid,
          score: s.score,
          suggestionId: s.suggestionId,
          status: s.status,
          matchedKeywords: [],
          tweet: s.tweet,
        }))

        if (flags.json) {
          process.stdout.write(JSON.stringify(mapped, null, 2) + '\n')
          exit()
          return
        }

        setItems(mapped)
        setTotal(historyTotal)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    load()
  }, [flags.status, flags.limit, flags.json])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!items) return <Spinner label="Loading history..." />

  if (items.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="yellow">No history yet.</Text>
        <Text dimColor>Triage some suggestions first with <Text color="cyan">sonar</Text></Text>
      </Box>
    )
  }

  if (flags.interactive) {
    const pageSize = flags.limit ?? 20
    const fetchMore = async (offset: number): Promise<HistoryItem[]> => {
      const vars: Record<string, unknown> = { limit: pageSize, offset }
      if (statusFilter) vars.status = statusFilter

      const res = await gql<{ suggestions: SuggestionResponse[] }>(HISTORY_QUERY, vars)
      const filtered = statusFilter
        ? res.suggestions
        : res.suggestions.filter(s => s.status !== 'INBOX')

      return filtered.map(s => ({
        key: s.tweet.xid,
        score: s.score,
        suggestionId: s.suggestionId,
        status: s.status,
        matchedKeywords: [],
        tweet: s.tweet,
      }))
    }
    return <HistoryBrowser items={items} total={total} fetchMore={fetchMore} />
  }

  // Non-interactive: render all items
  const statusLabel = flags.status ? flags.status : 'all'

  if (render === 'table') {
    const tableData: FeedTweet[] = items.map(i => ({
      score: i.score,
      matchedKeywords: i.matchedKeywords,
      tweet: i.tweet,
    }))
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="white">History</Text>
          <Text dimColor>  ·  {statusLabel} ({items.length})</Text>
        </Box>
        <FeedTable data={tableData} />
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text bold color="white">History</Text>
          <Text dimColor>  ·  {statusLabel}</Text>
          <Text dimColor> ({items.length})</Text>
        </Box>
        <Text dimColor>{'─'.repeat(Math.min(termWidth - 2, 72))}</Text>
      </Box>

      <Box flexDirection="column">
        {items.map((item, i) => (
          <Box key={item.key} flexDirection="column">
            <TweetCard
              item={{ score: item.score, matchedKeywords: item.matchedKeywords, tweet: item.tweet }}
              termWidth={termWidth}
              cardWidth={cardWidth}
              isLast={i === items.length - 1}
            />
            <Box marginLeft={2} marginBottom={i === items.length - 1 ? 0 : 1}>
              <Text dimColor>
                status: <Text color={item.status === 'ARCHIVED' ? 'gray' : item.status === 'LATER' ? 'yellow' : item.status === 'SKIPPED' ? 'red' : 'blue'}>{item.status.toLowerCase()}</Text>
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
