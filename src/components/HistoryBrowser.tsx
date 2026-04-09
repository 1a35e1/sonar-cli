import React, { useState, useEffect } from 'react'
import { Box, Text, useApp, useInput, useStdout } from 'ink'
import { TweetCard } from './TweetCard.js'
import { getFeedWidth } from '../lib/config.js'
import { openUrl } from '../lib/open.js'
import type { TriageItem } from './InteractiveSession.js'

export interface HistoryItem extends TriageItem {
  status: string
}

interface HistoryBrowserProps {
  items: HistoryItem[]
  total: number
  fetchMore?: (offset: number) => Promise<HistoryItem[]>
}

const STATUS_COLORS: Record<string, string> = {
  ARCHIVED: 'gray',
  LATER: 'yellow',
  READ: 'blue',
  SKIPPED: 'red',
  REPLIED: 'green',
}

function statusLabel(status: string): string {
  return status.toLowerCase()
}

function Divider({ width }: { width: number }) {
  return <Text dimColor>{'─'.repeat(Math.min(width - 2, 72))}</Text>
}

export function HistoryBrowser({ items: initialItems, total: initialTotal, fetchMore }: HistoryBrowserProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 100
  const cardWidth = getFeedWidth()

  const [items, setItems] = useState(initialItems)
  const [total, setTotal] = useState(initialTotal)
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  // Fetch next page when 3 items from the end
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

  const current = items[index]

  useInput((input, key) => {
    if (input === 'q') {
      exit()
    } else if (input === 'n' || key.return || input === ' ' || key.downArrow || key.rightArrow) {
      if (index < items.length - 1 || items.length < total) {
        setIndex(i => Math.min(i + 1, items.length - 1))
      }
    } else if (input === 'b' || key.upArrow || key.leftArrow) {
      setIndex(i => Math.max(0, i - 1))
    } else if (input === 'o' && current) {
      const handle = current.tweet.user.username ?? current.tweet.user.displayName
      const url = `https://x.com/${handle}/status/${current.tweet.id}`
      openUrl(url)
    }
  })

  if (!current) {
    return (
      <Box flexDirection="column" gap={1} marginTop={1}>
        <Text color="yellow">No history items found.</Text>
        <Text dimColor>Triage some suggestions first with <Text color="cyan">sonar</Text></Text>
      </Box>
    )
  }

  const statusColor = STATUS_COLORS[current.status] ?? 'white'

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} gap={3}>
        <Text dimColor>{index + 1} / {total}</Text>
        <Text color={statusColor}>{statusLabel(current.status)}</Text>
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
          <Text dimColor><Text color="white">b</Text> back</Text>
          <Text dimColor><Text color="white">n</Text> next</Text>
          <Text dimColor><Text color="white">o</Text> open</Text>
          <Text dimColor><Text color="white">q</Text> quit</Text>
        </Box>
      </Box>
    </Box>
  )
}
