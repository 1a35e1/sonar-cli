import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text, useStdout } from 'ink'
import Link from 'ink-link'
import { Spinner } from '../components/Spinner.js'
import { Table } from '../components/Table.js'
import { InteractiveFeedSession } from '../components/InteractiveSession.js'
import { gql } from '../lib/client.js'
import { getFeedRender, getFeedWidth, getVendor } from '../lib/config.js'

export const options = zod.object({
  hours: zod.number().optional().describe('Look back N hours (default: 12)'),
  days: zod.number().optional().describe('Look back N days'),
  limit: zod.number().optional().describe('Result limit (default: 20)'),
  kind: zod.string().optional().describe('Feed source: default|bookmarks|followers|following'),
  render: zod.string().optional().describe('Output layout: card|table'),
  width: zod.number().optional().describe('Card width in columns'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
  interactive: zod.boolean().default(false).describe('Interactive session mode'),
  vendor: zod.string().optional().describe('AI vendor: openai|anthropic'),
})

type Props = { options: zod.infer<typeof options> }

export default function Feed({ options: flags }: Props) {
  const [data, setData] = useState<FeedTweet[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 100

  const render = getFeedRender(flags.render)
  const cardWidth = getFeedWidth(flags.width)

  useEffect(() => {
    async function run() {
      try {
        const result = await gql<{ feed: FeedTweet[] }>(FEED_QUERY, {
          hours: flags.hours ?? null,
          days: flags.days ?? null,
          limit: flags.limit ?? 20,
          kind: flags.kind ?? 'default',
        })

        if (flags.json) {
          process.stdout.write(`${JSON.stringify(result.feed, null, 2)}\n`)
          process.exit(0)
        }

        setData(result.feed)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [flags.hours, flags.days, flags.limit, flags.json, flags.kind])

  if (error) {
    return <Text color="red">Error: {error}</Text>
  }

  if (!data) {
    return <Spinner label="Fetching feed..." />
  }

  if (data.length === 0) {
    return <Text dimColor>No tweets found in this window.</Text>
  }

  if (flags.interactive) {
    return <InteractiveFeedSession items={data} vendor={getVendor(flags.vendor)} />
  }

  const win = windowLabel(flags.hours, flags.days)

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text bold color="white">
            {flags.kind === 'bookmarks'
              ? 'Bookmarks Feed'
              : flags.kind === 'followers'
                ? 'Followers Feed'
                : flags.kind === 'following'
                  ? 'Following Feed'
                  : 'Network Feed'}
          </Text>
          {flags.kind !== 'bookmarks' && (
            <Text dimColor>
              {'  ·  '}last {win}
            </Text>
          )}
          <Text dimColor> ({data.length})</Text>
        </Box>
        <Text dimColor>{'─'.repeat(Math.min(termWidth - 2, 72))}</Text>
      </Box>
      {render === 'table' ? (
        <FeedTable data={data} />
      ) : (
        <Box flexDirection="column">
          {data.map((item, i) => (
            <TweetCard
              key={item.tweet.id}
              item={item}
              termWidth={termWidth}
              cardWidth={cardWidth}
              isLast={i === data.length - 1}
            />
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>tip  adjust window → </Text>
        <Text color="cyan">sonar feed --hours 24</Text>
      </Box>
    </Box>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  displayName: string
  username: string | null
  followersCount: number | null
  followingCount: number | null
}

export interface Tweet {
  id: string
  xid: string
  text: string
  createdAt: string
  likeCount: number
  retweetCount: number
  replyCount: number
  user: User
}

export interface FeedTweet {
  score: number
  matchedKeywords: string[]
  tweet: Tweet
}

// ─── Query ────────────────────────────────────────────────────────────────────

const FEED_QUERY = `
  query Feed($hours: Int, $days: Int, $limit: Int, $kind: String) {
    feed(hours: $hours, days: $days, limit: $limit, kind: $kind) {
      score
      matchedKeywords
      tweet {
        id
        xid
        text
        createdAt
        likeCount
        retweetCount
        replyCount
        user {
          displayName
          username
          followersCount
          followingCount
        }
      }
    }
  }
`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function windowLabel(hours?: number, days?: number): string {
  if (hours) return `${hours}h`
  if (days) return `${days}d`
  return '12h'
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.toLocaleString('en-US', { month: 'short' })
  const day = d.getDate()
  const hours = d.getHours()
  const mins = d.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  const h = hours % 12 || 12
  return `${month} ${day} · ${h}:${mins}${ampm}`
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function formatCount(n: number | null): string | null {
  if (n == null) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function scoreColor(score: number): string {
  if (score >= 0.7) return 'green'
  if (score >= 0.4) return 'yellow'
  return 'white'
}

function linkifyMentions(text: string): string {
  return text.replace(/@(\w+)/g, (match, handle) => {
    const url = `https://x.com/${handle}`
    return `\x1b]8;;${url}\x07\x1b[94m${match}\x1b[39m\x1b]8;;\x07`
  })
}

function TweetText({ text }: { text: string }) {
  return <Text wrap="wrap">{linkifyMentions(text)}</Text>
}

interface TweetCardProps {
  item: FeedTweet
  termWidth: number
  cardWidth: number
  isLast: boolean
}

export function TweetCard({ item, termWidth, cardWidth, isLast }: TweetCardProps) {
  const { tweet, score } = item
  const handle = tweet.user.username ?? tweet.user.displayName
  const author = `@${handle}`
  const bodyBoxWidth = Math.min(cardWidth + 2, termWidth)
  const profileUrl = `https://x.com/${handle}`
  const tweetUrl = `https://x.com/${handle}/status/${tweet.id}`

  return (
    <Box flexDirection="column" marginBottom={isLast ? 0 : 1} width={termWidth}>
      <Box>
        <Link url={tweetUrl} fallback={false}>
          <Text color="cyan" bold>
            {formatTimestamp(tweet.createdAt)}
          </Text>
        </Link>
        <Text dimColor> {relativeTime(tweet.createdAt)}</Text>
        {score > 0 && (
          <>
            <Text dimColor> · </Text>
            <Text color={scoreColor(score)}>{score.toFixed(2)}</Text>
          </>
        )}
      </Box>

      <Box>
        <Text color="gray">{'└'} </Text>
        <Link url={profileUrl} fallback={false}>
          <Text color="blueBright" bold>
            {author}
          </Text>
        </Link>
        {formatCount(tweet.user.followersCount) && (
          <>
            <Text dimColor>
              {' '}
              {formatCount(tweet.user.followersCount)} followers
            </Text>
            {formatCount(tweet.user.followingCount) && (
              <Text dimColor>
                {' '}
                · {formatCount(tweet.user.followingCount)} following
              </Text>
            )}
          </>
        )}
      </Box>

      <Box paddingLeft={2} width={bodyBoxWidth} marginTop={1}>
        <TweetText text={tweet.text} />
      </Box>

      <Box marginLeft={2} marginTop={1}>
        <Text color="red">♥ {tweet.likeCount}</Text>
        <Text dimColor> </Text>
        <Text color="green">↺ {tweet.retweetCount}</Text>
        {tweet.replyCount > 0 && (
          <>
            <Text dimColor> </Text>
            <Text dimColor>↩ {tweet.replyCount}</Text>
          </>
        )}
      </Box>

      {item.matchedKeywords.length > 0 && (
        <Box marginLeft={2}>
          <Text dimColor>keywords  </Text>
          <Text color="yellow">{item.matchedKeywords.join('  ')}</Text>
        </Box>
      )}

      <Box marginLeft={2}>
        <Link url={profileUrl} fallback={false}>
          <Text dimColor>{profileUrl}</Text>
        </Link>
        <Text dimColor> · </Text>
        <Link url={tweetUrl} fallback={false}>
          <Text dimColor>{tweetUrl}</Text>
        </Link>
      </Box>

      {!isLast && (
        <Box marginTop={1}>
          <Text dimColor>{'─'.repeat(Math.min(termWidth - 2, 72))}</Text>
        </Box>
      )}
    </Box>
  )
}

function osc8Link(url: string, label: string): string {
  return `\x1b]8;;${url}\x07${label}\x1b]8;;\x07`
}

function FeedTable({ data }: { data: FeedTweet[] }) {
  const rows = data.map((item) => {
    const handle = item.tweet.user.username ?? item.tweet.user.displayName
    const tweetUrl = `https://x.com/${handle}/status/${item.tweet.id}`
    return {
      age: osc8Link(tweetUrl, relativeTime(item.tweet.createdAt)),
      score: item.score > 0 ? item.score.toFixed(2) : '—',
      author: `@${handle}`,
      tweet: item.tweet.text.replace(/\n/g, ' ').slice(0, 80),
    }
  })
  return <Table rows={rows} columns={['age', 'score', 'author', 'tweet']} />
}
