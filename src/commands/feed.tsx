import React, { useEffect, useRef, useState } from 'react'
import zod from 'zod'
import { Box, Text, useApp, useInput, useStdout } from 'ink'
import { Banner } from '../components/Banner.js'
import { Spinner } from '../components/Spinner.js'
import { gql } from '../lib/client.js'
import { getFeedRender, getFeedWidth } from '../lib/config.js'
import { TweetCard, FeedTable } from '../components/TweetCard.js'
import type { FeedTweet } from '../components/TweetCard.js'

export const options = zod.object({
  hours: zod.number().optional().describe('Look back N hours (default: 12)'),
  days: zod.number().optional().describe('Look back N days'),
  limit: zod.number().optional().describe('Result limit (default: 20)'),
  kind: zod.string().optional().describe('Feed source: default|bookmarks|followers|following'),
  render: zod.string().optional().describe('Output layout: card|table'),
  width: zod.number().optional().describe('Card width in columns'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
  follow: zod.boolean().default(false).describe('Continuously poll for new items'),
  interval: zod.number().optional().describe('Poll interval in seconds (default: 30)'),
})

type Props = { options: zod.infer<typeof options> }

const FEED_QUERY = `
  query Feed($hours: Int, $days: Int, $limit: Int, $kind: String) {
    feed(hours: $hours, days: $days, limit: $limit, kind: $kind) {
      score
      matchedKeywords
      tweet {
        id xid text createdAt likeCount retweetCount replyCount
        user { displayName username followersCount followingCount }
      }
    }
  }
`

const HAS_INTERESTS_QUERY = `query HasInterests { topics { id: nanoId } }`

export default function Feed({ options: flags }: Props) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 100
  const cardWidth = getFeedWidth(flags.width)
  const render = getFeedRender(flags.render)
  const pollInterval = Math.max(5, flags.interval ?? 30) * 1000

  const [items, setItems] = useState<FeedTweet[]>([])
  const [noInterests, setNoInterests] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialLoad, setInitialLoad] = useState(true)
  const [pollCount, setPollCount] = useState(0)
  const seenRef = useRef(new Set<string>())

  const feedVars = {
    hours: flags.hours ?? null,
    days: flags.days ?? null,
    limit: flags.limit ?? 20,
    kind: flags.kind ?? 'default',
  }

  useEffect(() => {
    async function poll() {
      try {
        if (initialLoad) {
          const { topics } = await gql<{ topics: { id: string }[] }>(HAS_INTERESTS_QUERY)
          if (topics.length === 0) {
            setNoInterests(true)
            return
          }
        }

        const res = await gql<{ feed: FeedTweet[] }>(FEED_QUERY, feedVars)
        const newItems = res.feed.filter(f => !seenRef.current.has(f.tweet.xid))
        for (const f of newItems) seenRef.current.add(f.tweet.xid)

        if (flags.json && flags.follow) {
          // NDJSON: one line per new item
          for (const item of newItems) {
            process.stdout.write(JSON.stringify(item) + '\n')
          }
        } else if (flags.json && initialLoad) {
          // Single-shot JSON
          process.stdout.write(JSON.stringify(res.feed, null, 2) + '\n')
          process.exit(0)
        } else {
          setItems(prev => [...prev, ...newItems])
        }

        setInitialLoad(false)
        setPollCount(c => c + 1)
        setError(null)
      } catch (err) {
        if (flags.follow) {
          // In follow mode, log to stderr and keep polling
          process.stderr.write(`poll error: ${err instanceof Error ? err.message : String(err)}\n`)
        } else {
          setError(err instanceof Error ? err.message : String(err))
        }
        setInitialLoad(false)
      }
    }

    poll()
    if (!flags.follow) return
    const timer = setInterval(poll, pollInterval)
    return () => clearInterval(timer)
  }, [])

  // Exit after first render in non-follow mode
  useEffect(() => {
    if (!flags.follow && !initialLoad && !noInterests && !error) {
      // Let React render one frame then exit
    }
  }, [initialLoad])

  // Quit with 'q' in follow mode
  useInput((input) => {
    if (input === 'q') exit()
  }, { isActive: flags.follow })

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

  if (initialLoad) return <Spinner label="Loading feed..." />

  if (items.length === 0 && !flags.follow) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="yellow">Nothing to show yet.</Text>
        <Box flexDirection="column" gap={0}>
          <Text dimColor>  1. Refresh pipeline:  <Text color="cyan">sonar refresh</Text></Text>
          <Text dimColor>  2. Widen window:      <Text color="cyan">sonar feed --hours 48</Text></Text>
          <Text dimColor>  3. Check status:      <Text color="cyan">sonar status</Text></Text>
        </Box>
      </Box>
    )
  }

  // Follow mode with JSON handled in useEffect (writes directly to stdout)
  if (flags.follow && flags.json) {
    return (
      <Box>
        <Spinner label={`streaming · ${seenRef.current.size} items · q to quit`} />
      </Box>
    )
  }

  const kindLabel =
    flags.kind === 'bookmarks' ? 'Bookmarks'
    : flags.kind === 'followers' ? 'Followers'
    : flags.kind === 'following' ? 'Following'
    : 'For you'

  const win = flags.days ? `${flags.days}d` : `${flags.hours ?? 12}h`

  if (render === 'table') {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="white">{kindLabel}</Text>
          <Text dimColor>  ·  last {win} ({items.length})</Text>
        </Box>
        <FeedTable data={items} />
        {flags.follow && (
          <Box marginTop={1}>
            <Text dimColor>polling every {pollInterval / 1000}s · {items.length} items · <Text color="cyan">q</Text> to quit</Text>
          </Box>
        )}
      </Box>
    )
  }

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
          <TweetCard
            key={item.tweet.xid}
            item={item}
            termWidth={termWidth}
            cardWidth={cardWidth}
            isLast={i === items.length - 1}
          />
        ))}
      </Box>

      {flags.follow ? (
        <Box marginTop={1}>
          <Text dimColor>polling every {pollInterval / 1000}s · {items.length} items · <Text color="cyan">q</Text> to quit</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor>tip  refresh → </Text>
          <Text color="cyan">sonar refresh</Text>
          <Text dimColor>  ·  follow → </Text>
          <Text color="cyan">sonar feed --follow</Text>
        </Box>
      )}
    </Box>
  )
}
