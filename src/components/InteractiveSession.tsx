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
  total?: number
  fetchMore?: (offset: number) => Promise<TriageItem[]>
}

type ActionLabel = 'dismissed' | 'saved' | null

// How long the user has to press 'u' and cancel an action before it is
// committed to the server. 10 s is long enough to feel safe but short enough
// that the feed doesn't feel laggy when switching items quickly.
const UNDO_WINDOW_MS = 10_000

interface PendingAction {
  timer: ReturnType<typeof setTimeout>
  suggestionId: string
  status: string
  // Saved so undo() can jump back to the exact card that was acted on.
  index: number
}

export function TriageSession({ items: initialItems, total: initialTotal, fetchMore }: TriageSessionProps) {
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 100
  const cardWidth = getFeedWidth()

  const [items, setItems] = useState(initialItems)
  const [total, setTotal] = useState(initialTotal ?? initialItems.length)
  const [index, setIndex] = useState(0)
  const [lastAction, setLastAction] = useState<ActionLabel>(null)
  const [acting, setActing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)

  // Prefetch the next page while the user still has a few cards to review so
  // there is no perceptible pause when they reach the end of the current batch.
  // The threshold of 3 gives enough time for the round-trip without loading too
  // eagerly when the inbox is small.
  useEffect(() => {
    if (!fetchMore || loading) return
    if (index >= items.length - 3 && items.length < total) {
      setLoading(true)
      fetchMore(items.length)
        .then(more => {
          if (more.length > 0) {
            setItems(prev => [...prev, ...more])
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [index, items.length, total, loading])

  // If the user quits mid-session (e.g. presses 'q'), commit any deferred
  // action immediately rather than losing it. This runs in a cleanup effect so
  // it fires both on normal unmounts and on process exit via Ink's teardown.
  useEffect(() => {
    return () => { if (pending) { clearTimeout(pending.timer); commitAction(pending) } }
  }, [pending])

  const done = index >= items.length && items.length >= total
  const current = items[index]

  function commitAction(action: PendingAction) {
    gql(UPDATE_MUTATION, { suggestionId: action.suggestionId, status: action.status })
      .catch(() => {})
  }

  const act = useCallback(
    (status: 'ARCHIVED' | 'SKIPPED', label: ActionLabel) => {
      const item = items[index]

      // Flush any previous pending action immediately
      if (pending) {
        clearTimeout(pending.timer)
        commitAction(pending)
      }

      if (item.suggestionId) {
        // Defer the mutation — can be undone within the window
        const timer = setTimeout(() => {
          commitAction({ timer: 0 as any, suggestionId: item.suggestionId!, status, index })
          setPending(null)
        }, UNDO_WINDOW_MS)

        setPending({ timer, suggestionId: item.suggestionId, status, index })
      }

      setLastAction(label)
      setIndex((i) => i + 1)
    },
    [index, items, pending],
  )

  const undo = useCallback(() => {
    if (!pending) return

    clearTimeout(pending.timer)
    setPending(null)
    setIndex(pending.index)
    setLastAction(null)
  }, [pending])

  // Keyboard handler — two distinct states:
  //
  // DONE state (inbox zero): only 'q' (quit) and 'u' (undo last action) are
  // active. All other keys are ignored so the user doesn't accidentally trigger
  // something after finishing.
  //
  // ACTIVE state (reviewing cards):
  //   n / d / <space> / <return> — dismiss (SKIPPED): marks the suggestion as
  //     not interesting; multiple aliases because muscle memory varies.
  //   s — save (ARCHIVED): bookmarks the suggestion for later.
  //   u — undo: cancels the deferred mutation and jumps back one card.
  //   o — open in browser: constructs the tweet URL and calls macOS `open`.
  //       Falls back silently on non-macOS systems where `open` is missing.
  //   q — quit: exits the process immediately (pending action is flushed first
  //       by the unmount effect above).
  //
  // { isActive: !acting } suspends input while a mutation is in flight (acting)
  // so rapid key-presses don't queue up duplicate mutations.
  useInput(
    (input, key) => {
      if (done) {
        if (input === 'q') process.exit(0)
        if (input === 'u') undo()
        return
      }

      if (key.return || input === ' ' || input === 'd' || input === 'n') {
        act('SKIPPED', 'dismissed')
      } else if (input === 's') {
        act('ARCHIVED', 'saved')
      } else if (input === 'u') {
        undo()
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
        <Text color="green">✓ Inbox zero</Text>
        {lastAction && <Text dimColor>last: {lastAction}</Text>}
        <Text dimColor>q to quit</Text>
      </Box>
    )
  }

  const canTriage = !!current.suggestionId

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} gap={3}>
        <Text dimColor>{index + 1} / {total}</Text>
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
              <Text dimColor><Text color="white">n</Text> next</Text>
              <Text dimColor><Text color="white">s</Text> save</Text>
              <Text dimColor><Text color="white">o</Text> open</Text>
              <Text dimColor><Text color="white">q</Text> quit</Text>
            </>
          ) : (
            <>
              <Text dimColor><Text color="white">n</Text> next</Text>
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
