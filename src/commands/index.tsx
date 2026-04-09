import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text, useStdout } from 'ink'
import { Banner } from '../components/Banner.js'
import { Spinner } from '../components/Spinner.js'
import { TriageSession } from '../components/InteractiveSession.js'
import type { TriageItem } from '../components/InteractiveSession.js'
import { gql } from '../lib/client.js'
import { getFeedRender, getFeedWidth } from '../lib/config.js'
import { TweetCard } from '../components/TweetCard.js'

export const args = zod.tuple([]).rest(zod.string())

export const options = zod.object({
  hours: zod.number().optional().describe('Look back N hours (default: 12)'),
  days: zod.number().optional().describe('Look back N days'),
  limit: zod.number().optional().describe('Result limit (default: 20)'),
  kind: zod.string().optional().describe('Feed source: default|bookmarks|followers|following'),
  render: zod.string().optional().describe('Output layout: card|table'),
  width: zod.number().optional().describe('Card width in columns'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
  interactive: zod.boolean().default(true).describe('Interactive session mode (default: on, use --no-interactive to disable)'),
  vendor: zod.string().optional().describe('AI vendor: openai|anthropic'),
})

type Props = { options: zod.infer<typeof options>; args: string[] }

interface SuggestionItem {
  suggestionId: string
  score: number
  tweet: {
    id: string
    xid: string
    text: string
    createdAt: string
    likeCount: number
    retweetCount: number
    replyCount: number
    user: { displayName: string; username: string | null; followersCount: number | null; followingCount: number | null }
  }
}

interface UnifiedItem extends TriageItem {
  source: 'suggestion' | 'feed'
}

const INBOX_QUERY = `
  query Inbox($status: SuggestionStatus, $limit: Int, $offset: Int) {
    suggestions(status: $status, limit: $limit, offset: $offset) {
      suggestionId score
      tweet {
        id xid text createdAt likeCount retweetCount replyCount
        user { displayName username followersCount followingCount }
      }
    }
    suggestionCounts { inbox }
  }
`

const HAS_INTERESTS_QUERY = `query HasInterests { topics { id: nanoId } }`

export default function Sonar({ options: flags, args: positionalArgs }: Props) {
  const [items, setItems] = useState<UnifiedItem[] | null>(null)
  const [total, setTotal] = useState(0)
  const [noInterests, setNoInterests] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Unknown subcommand — show help hint
  if (positionalArgs && positionalArgs.length > 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="red">Unknown command: {positionalArgs.join(' ')}</Text>
        <Text dimColor>Run <Text color="cyan">sonar --help</Text> to see available commands.</Text>
      </Box>
    )
  }
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 100
  const cardWidth = getFeedWidth(flags.width)
  const render = getFeedRender(flags.render)

  useEffect(() => {
    async function run() {
      try {
        const limit = flags.limit ?? 20

        const { topics } = await gql<{ topics: { id: string }[] }>(HAS_INTERESTS_QUERY)
        if (topics.length === 0) {
          setNoInterests(true)
          return
        }

        const inboxRes = await gql<{ suggestions: SuggestionItem[]; suggestionCounts: { inbox: number } }>(INBOX_QUERY, { status: 'INBOX', limit, offset: 0 })

        const inboxTotal = inboxRes.suggestionCounts.inbox

        const merged: UnifiedItem[] = inboxRes.suggestions.map(s => ({
          key: s.tweet.xid,
          score: s.score,
          source: 'suggestion' as const,
          suggestionId: s.suggestionId,
          matchedKeywords: [],
          tweet: {
            id: s.tweet.id,
            xid: s.tweet.xid,
            text: s.tweet.text,
            createdAt: s.tweet.createdAt,
            likeCount: s.tweet.likeCount,
            retweetCount: s.tweet.retweetCount,
            replyCount: s.tweet.replyCount,
            user: s.tweet.user,
          },
        }))

        if (flags.json) {
          process.stdout.write(JSON.stringify(merged, null, 2) + '\n')
          process.exit(0)
        }

        setItems(merged)
        setTotal(inboxTotal)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [flags.hours, flags.days, flags.limit, flags.kind, flags.json])

  if (error) return <Text color="red">Error: {error}</Text>

  if (noInterests) {
    return (
      <Box flexDirection="column" gap={1}>
        <Banner />
        <Text dimColor>No topics yet. Add one to get started:</Text>
        <Box flexDirection="column" gap={0}>
          <Text color="cyan">  sonar topics add "AI agents"</Text>
          <Text color="cyan">  sonar topics add "Rust and systems programming"</Text>
        </Box>
      </Box>
    )
  }

  if (!items) return <Spinner label="Loading..." />

  if (items.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="yellow">Nothing to show yet.</Text>
        <Box flexDirection="column" gap={0}>
          <Text dimColor>  1. Refresh pipeline:  <Text color="cyan">sonar refresh</Text></Text>
          <Text dimColor>  2. Widen window:      <Text color="cyan">sonar --hours 48</Text></Text>
          <Text dimColor>  3. Check status:      <Text color="cyan">sonar status</Text></Text>
        </Box>
      </Box>
    )
  }

  if (flags.interactive) {
    const pageSize = flags.limit ?? 20
    const fetchMore = async (offset: number): Promise<UnifiedItem[]> => {
      const res = await gql<{ suggestions: SuggestionItem[] }>(INBOX_QUERY, {
        status: 'INBOX', limit: pageSize, offset,
      })
      return res.suggestions.map(s => ({
        key: s.tweet.xid,
        score: s.score,
        source: 'suggestion' as const,
        suggestionId: s.suggestionId,
        matchedKeywords: [],
        tweet: {
          id: s.tweet.id,
          xid: s.tweet.xid,
          text: s.tweet.text,
          createdAt: s.tweet.createdAt,
          likeCount: s.tweet.likeCount,
          retweetCount: s.tweet.retweetCount,
          replyCount: s.tweet.replyCount,
          user: s.tweet.user,
        },
      }))
    }
    return <TriageSession items={items} total={total} fetchMore={fetchMore} />
  }

  const kindLabel =
    flags.kind === 'bookmarks' ? 'Bookmarks'
    : flags.kind === 'followers' ? 'Followers'
    : flags.kind === 'following' ? 'Following'
    : 'For you'

  const win = flags.days ? `${flags.days}d` : `${flags.hours ?? 12}h`

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text bold color="white">{kindLabel}</Text>
          <Text dimColor>  ·  last {win}</Text>
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
              isLast={i === items.length - 1 && !item.suggestionId}
            />
            {item.suggestionId && (
              <Box marginLeft={2} marginBottom={i === items.length - 1 ? 0 : 1}>
                <Text dimColor>
                  {item.suggestionId.slice(0, 8)}{'  ·  '}
                  sonar archive --id {item.suggestionId.slice(0, 8)}{'  ·  '}
                  sonar later --id {item.suggestionId.slice(0, 8)}{'  ·  '}
                  sonar skip --id {item.suggestionId.slice(0, 8)}
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>tip  refresh → </Text>
        <Text color="cyan">sonar refresh</Text>
        <Text dimColor>  ·  widen window → </Text>
        <Text color="cyan">sonar --hours 48</Text>
      </Box>
    </Box>
  )
}
