import React, { useState, useCallback, useEffect } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { gql } from '../lib/client.js'
import { relativeTime, TweetCard } from './TweetCard.js'
import { getFeedWidth } from '../lib/config.js'
import { execSync } from 'child_process'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TriageItem {
  key: string
  score: number
  suggestionId?: string
  matchedKeywords: string[]
  tweet: {
    id: string
    xid: string
    text: string
    createdAt: string
    likeCount: number
    retweetCount: number
    replyCount: number
    user: {
      displayName: string
      username: string | null
      followersCount: number | null
      followingCount: number | null
    }
  }
}

const UPDATE_MUTATION = `
  mutation UpdateSuggestion($suggestionId: ID!, $status: SuggestionStatus!) {
    updateSuggestion(input: { suggestionId: $suggestionId, status: $status }) {
      suggestionId
      status
    }
  }
`

function Divider({ width }: { width: number }) {
  return <Text dimColor>{'─'.repeat(Math.min(width - 2, 72))}</Text>
}

// ─── Triage Session ───────────────────────────────────────────────────────────

interface TriageSessionProps {
  items: TriageItem[]
}

type ActionLabel = 'archived' | 'saved for later' | 'skipped' | null

export function TriageSession({ items }: TriageSessionProps) {
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 100
  const cardWidth = getFeedWidth()

  const [index, setIndex] = useState(0)
  const [lastAction, setLastAction] = useState<ActionLabel>(null)
  const [acting, setActing] = useState(false)

  const done = index >= items.length
  const current = items[index]

  // Fire mutation in background, advance immediately
  const act = useCallback(
    (status: 'ARCHIVED' | 'LATER' | 'SKIPPED' | null, label: ActionLabel) => {
      if (acting) return
      const item = items[index]

      if (status && item.suggestionId) {
        setActing(true)
        gql(UPDATE_MUTATION, { suggestionId: item.suggestionId, status })
          .catch(() => {}) // silent — don't block the user
          .finally(() => setActing(false))
      }

      setLastAction(label)
      setIndex((i) => i + 1)
    },
    [index, items, acting],
  )

  useInput(
    (input, key) => {
      if (done) {
        if (input === 'q') process.exit(0)
        return
      }

      if (key.return || input === ' ') {
        act('SKIPPED', 'skipped')
      } else if (input === 'a') {
        act('ARCHIVED', 'archived')
      } else if (input === 'l') {
        act('LATER', 'saved for later')
      } else if (input === 'o') {
        const handle = current.tweet.user.username ?? current.tweet.user.displayName
        const url = `https://x.com/${handle}/status/${current.tweet.id}`
        try { execSync(`open "${url}"`) } catch {}
      } else if (input === 'q') {
        process.exit(0)
      }
    },
    { isActive: !acting },
  )

  if (done) {
    return (
      <Box flexDirection="column" gap={1} marginTop={1}>
        <Text color="green">✓ All clear</Text>
        {lastAction && <Text dimColor>last: {lastAction}</Text>}
        <Text dimColor>q to quit</Text>
      </Box>
    )
  }

  const handle = current.tweet.user.username ?? current.tweet.user.displayName
  const tweetUrl = `https://x.com/${handle}/status/${current.tweet.id}`
  const canTriage = !!current.suggestionId

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} gap={3}>
        <Text dimColor>{index + 1} / {items.length}</Text>
        {lastAction && <Text color="green">✓ {lastAction}</Text>}
      </Box>

      <TweetCard
        item={{ score: current.score, matchedKeywords: current.matchedKeywords, tweet: current.tweet }}
        termWidth={termWidth}
        cardWidth={cardWidth}
        isLast={true}
      />

      <Box flexDirection="column" marginTop={1}>
        <Divider width={termWidth} />
        <Box marginTop={1} gap={3}>
          {canTriage ? (
            <>
              <Text dimColor><Text color="white">space</Text> skip</Text>
              <Text dimColor><Text color="white">a</Text> archive</Text>
              <Text dimColor><Text color="white">l</Text> later</Text>
              <Text dimColor><Text color="white">o</Text> open</Text>
              <Text dimColor><Text color="white">q</Text> quit</Text>
            </>
          ) : (
            <>
              <Text dimColor><Text color="white">space</Text> next</Text>
              <Text dimColor><Text color="white">o</Text> open</Text>
              <Text dimColor><Text color="white">q</Text> quit</Text>
            </>
          )}
        </Box>
      </Box>
    </Box>
  )
}

// ─── Legacy aliases ───────────────────────────────────────────────────────────
// Kept for any remaining references — both now delegate to TriageSession

export type { TriageItem as FeedItem }

export function InteractiveFeedSession({ items }: { items: TriageItem[]; vendor?: string }) {
  return <TriageSession items={items} />
}

export function InteractiveInboxSession({ items }: { items: any[]; vendor?: string }) {
  return <TriageSession items={items} />
}
