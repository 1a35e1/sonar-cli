import React, { useState, useCallback } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { Spinner } from './Spinner.js'
import { TweetCard } from '../commands/feed.js'
import { gql } from '../lib/client.js'
import { generateReply } from '../lib/ai.js'
import { getFeedWidth } from '../lib/config.js'
import type { Vendor } from '../lib/config.js'

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'view' | 'reply-input' | 'reply-loading' | 'reply-draft'

interface FeedUser {
  displayName: string
  username: string | null
  followersCount: number | null
  followingCount: number | null
}

interface FeedTweet {
  id: string
  xid: string
  text: string
  createdAt: string
  likeCount: number
  retweetCount: number
  replyCount: number
  user: FeedUser
}

export interface FeedItem {
  score: number
  matchedKeywords: string[]
  tweet: FeedTweet
}

interface InboxUser {
  displayName: string
  username: string | null
}

interface InboxTweet {
  xid: string
  text: string
  createdAt: string
  user: InboxUser
}

export interface Suggestion {
  suggestionId: string
  score: number
  projectsMatched: number
  status: string
  relevance: number | null
  tweet: InboxTweet
}

const UPDATE_SUGGESTION_MUTATION = `
  mutation UpdateSuggestion($suggestionId: ID!, $status: SuggestionStatus!) {
    updateSuggestion(input: { suggestionId: $suggestionId, status: $status }) {
      suggestionId
      status
    }
  }
`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function Divider({ width }: { width: number }) {
  return <Text dimColor>{'─'.repeat(Math.min(width - 2, 72))}</Text>
}

// ─── Shared hook ──────────────────────────────────────────────────────────────

function useInteractiveState(total: number, vendor: Vendor) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('view')
  const [replyInput, setReplyInput] = useState('')
  const [replyDraft, setReplyDraft] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, total - 1))
    setMode('view')
    setReplyDraft('')
    setStatusMessage('')
  }, [total])

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0))
    setMode('view')
    setReplyDraft('')
    setStatusMessage('')
  }, [])

  const startReply = useCallback(() => {
    setReplyInput('')
    setMode('reply-input')
  }, [])

  const dismissDraft = useCallback(() => {
    setReplyDraft('')
    setMode('view')
  }, [])

  const handleReply = useCallback(
    async (tweetText: string, angle: string) => {
      setMode('reply-loading')
      try {
        const result = await generateReply(tweetText, angle, vendor)
        setReplyDraft(result.reply)
        setMode('reply-draft')
      } catch (err) {
        setStatusMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
        setMode('view')
      }
    },
    [vendor],
  )

  return {
    currentIndex,
    mode,
    replyInput,
    replyDraft,
    statusMessage,
    setReplyInput,
    setMode,
    setStatusMessage,
    goNext,
    goPrev,
    startReply,
    dismissDraft,
    handleReply,
  }
}

// ─── Interactive Feed Session ─────────────────────────────────────────────────

interface InteractiveFeedSessionProps {
  items: FeedItem[]
  vendor: Vendor
}

export function InteractiveFeedSession({ items, vendor }: InteractiveFeedSessionProps) {
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 100
  const cardWidth = getFeedWidth()

  const {
    currentIndex,
    mode,
    replyInput,
    replyDraft,
    statusMessage,
    setReplyInput,
    setMode,
    setStatusMessage,
    goNext,
    goPrev,
    startReply,
    dismissDraft,
    handleReply,
  } = useInteractiveState(items.length, vendor)

  const current = items[currentIndex]

  useInput(
    (input, key) => {
      if (mode === 'reply-loading') return

      if (mode === 'reply-input') {
        if (key.return) {
          handleReply(current.tweet.text, replyInput)
        } else if (key.escape) {
          setMode('view')
          setReplyInput('')
        } else if (key.backspace || key.delete) {
          setReplyInput((s) => s.slice(0, -1))
        } else if (input && !key.ctrl && !key.meta) {
          setReplyInput((s) => s + input)
        }
        return
      }

      if (mode === 'reply-draft') {
        if (input === 'r') {
          handleReply(current.tweet.text, '')
        } else if (key.escape) {
          dismissDraft()
        }
        return
      }

      // view mode
      if (input === 'n' || key.rightArrow || input === ' ') {
        goNext()
      } else if (input === 'p' || key.leftArrow) {
        goPrev()
      } else if (input === 'r') {
        startReply()
      } else if (input === 's') {
        setStatusMessage('star — coming soon')
      } else if (input === 'a') {
        setStatusMessage('analyze — coming soon')
      } else if (input === 'q') {
        process.exit(0)
      }
    },
    { isActive: mode !== 'reply-loading' },
  )

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text dimColor>
          {'  '}
          {currentIndex + 1} / {items.length}{'  ·  '}feed --interactive
        </Text>
      </Box>

      <TweetCard item={current} termWidth={termWidth} cardWidth={cardWidth} isLast={true} />

      {mode === 'reply-draft' && (
        <Box flexDirection="column" marginTop={1}>
          <Divider width={termWidth} />
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Draft reply:</Text>
            <Box marginTop={1} paddingLeft={2} width={Math.min(termWidth, 80)}>
              <Text wrap="wrap">{replyDraft}</Text>
            </Box>
          </Box>
        </Box>
      )}

      {statusMessage && (
        <Box marginTop={1}>
          <Text color="green">{statusMessage}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        <Divider width={termWidth} />
        {mode === 'reply-input' ? (
          <Box marginTop={1}>
            <Text dimColor>Angle (Enter to auto-generate, Esc to cancel): </Text>
            <Text>{replyInput}</Text>
            <Text color="cyan">█</Text>
          </Box>
        ) : mode === 'reply-loading' ? (
          <Box marginTop={1}>
            <Spinner label="Generating reply..." />
          </Box>
        ) : mode === 'reply-draft' ? (
          <Box marginTop={1}>
            <Text dimColor>[r] new draft  [Esc] dismiss</Text>
          </Box>
        ) : (
          <Box marginTop={1}>
            <Text dimColor>[n]ext  [p]rev  [s]tar  [r]eply  [a]nalyze  [q]uit</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 0.7) return 'green'
  if (score >= 0.4) return 'yellow'
  return 'white'
}

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'inbox': return 'cyan'
    case 'read': return 'green'
    case 'skipped': return 'gray'
    case 'later': return 'yellow'
    case 'archived': return 'magenta'
    default: return 'white'
  }
}

function SuggestionCard({ item, termWidth }: { item: Suggestion; termWidth: number }) {
  const handle = item.tweet.user.username ?? item.tweet.user.displayName
  const author = `@${handle}`
  const profileUrl = `https://x.com/${handle}`
  const tweetUrl = `https://x.com/${handle}/status/${item.tweet.xid}`

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan" bold>
          {relativeTime(item.tweet.createdAt)}
        </Text>
        <Text dimColor>  ·  </Text>
        <Text color={scoreColor(item.score)}>{item.score.toFixed(2)}</Text>
        <Text dimColor>  ·  </Text>
        <Text color={statusColor(item.status)}>{item.status.toLowerCase()}</Text>
        {item.projectsMatched > 0 && (
          <Text dimColor>  ·  {item.projectsMatched} interest{item.projectsMatched !== 1 ? 's' : ''}</Text>
        )}
      </Box>

      <Box>
        <Text color="gray">{'└'} </Text>
        <Text color="blueBright" bold>
          {author}
        </Text>
      </Box>

      <Box paddingLeft={2} width={Math.min(termWidth, 82)} marginTop={1}>
        <Text wrap="wrap">{item.tweet.text}</Text>
      </Box>

      <Box marginLeft={2} marginTop={1}>
        <Text dimColor>{profileUrl} · {tweetUrl}</Text>
      </Box>
    </Box>
  )
}

// ─── Interactive Inbox Session ────────────────────────────────────────────────

interface InteractiveInboxSessionProps {
  items: Suggestion[]
  vendor: Vendor
}

const INBOX_STATUS_KEYS: Record<string, string> = {
  R: 'READ',
  S: 'SKIPPED',
  L: 'LATER',
  A: 'ARCHIVED',
}

export function InteractiveInboxSession({ items, vendor }: InteractiveInboxSessionProps) {
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 100
  const [isActing, setIsActing] = useState(false)

  const {
    currentIndex,
    mode,
    replyInput,
    replyDraft,
    statusMessage,
    setReplyInput,
    setMode,
    setStatusMessage,
    goNext,
    goPrev,
    startReply,
    dismissDraft,
    handleReply,
  } = useInteractiveState(items.length, vendor)

  const current = items[currentIndex]

  const handleStatusUpdate = useCallback(
    async (status: string) => {
      setIsActing(true)
      try {
        await gql<{ updateSuggestion: { suggestionId: string; status: string } }>(
          UPDATE_SUGGESTION_MUTATION,
          { suggestionId: current.suggestionId, status },
        )
        setStatusMessage(`✓ marked as ${status.toLowerCase()}`)
      } catch (err) {
        setStatusMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setIsActing(false)
      }
    },
    [current.suggestionId, setStatusMessage],
  )

  useInput(
    (input, key) => {
      if (isActing || mode === 'reply-loading') return

      if (mode === 'reply-input') {
        if (key.return) {
          handleReply(current.tweet.text, replyInput)
        } else if (key.escape) {
          setMode('view')
          setReplyInput('')
        } else if (key.backspace || key.delete) {
          setReplyInput((s) => s.slice(0, -1))
        } else if (input && !key.ctrl && !key.meta) {
          setReplyInput((s) => s + input)
        }
        return
      }

      if (mode === 'reply-draft') {
        if (input === 'r') {
          handleReply(current.tweet.text, '')
        } else if (key.escape) {
          dismissDraft()
        }
        return
      }

      // view mode
      if (input === 'n' || key.rightArrow || input === ' ') {
        goNext()
      } else if (input === 'p' || key.leftArrow) {
        goPrev()
      } else if (input === 'r') {
        startReply()
      } else if (input === 'a') {
        setStatusMessage('analyze — coming soon')
      } else if (input === 'q') {
        process.exit(0)
      } else if (INBOX_STATUS_KEYS[input]) {
        handleStatusUpdate(INBOX_STATUS_KEYS[input])
      }
    },
    { isActive: !isActing && mode !== 'reply-loading' },
  )

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text dimColor>
          {'  '}
          {currentIndex + 1} / {items.length}{'  ·  '}inbox --interactive
        </Text>
      </Box>

      <SuggestionCard item={current} termWidth={termWidth} />

      {mode === 'reply-draft' && (
        <Box flexDirection="column" marginTop={1}>
          <Divider width={termWidth} />
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Draft reply:</Text>
            <Box marginTop={1} paddingLeft={2} width={Math.min(termWidth, 80)}>
              <Text wrap="wrap">{replyDraft}</Text>
            </Box>
          </Box>
        </Box>
      )}

      {statusMessage && (
        <Box marginTop={1}>
          <Text color="green">{statusMessage}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        <Divider width={termWidth} />
        {isActing ? (
          <Box marginTop={1}>
            <Spinner label="Updating..." />
          </Box>
        ) : mode === 'reply-input' ? (
          <Box marginTop={1}>
            <Text dimColor>Angle (Enter to auto-generate, Esc to cancel): </Text>
            <Text>{replyInput}</Text>
            <Text color="cyan">█</Text>
          </Box>
        ) : mode === 'reply-loading' ? (
          <Box marginTop={1}>
            <Spinner label="Generating reply..." />
          </Box>
        ) : mode === 'reply-draft' ? (
          <Box marginTop={1}>
            <Text dimColor>[r] new draft  [Esc] dismiss</Text>
          </Box>
        ) : (
          <Box marginTop={1}>
            <Text dimColor>[n]ext  [p]rev  [r]eply  [a]nalyze  [R]ead  [S]kip  [L]ater  [A]rchive  [q]uit</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}
