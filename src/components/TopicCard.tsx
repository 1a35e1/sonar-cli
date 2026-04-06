import React from 'react'
import { Box, Text } from 'ink'
import type { Topic } from '../commands/topics/index.js'

interface TopicCardProps {
  topic: Topic
  termWidth: number
  isLast: boolean
}

export function TopicCard({ topic, termWidth, isLast }: TopicCardProps) {
  const updatedAt = new Date(topic.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Truncate description to ~2 lines
  const maxDescLen = Math.min(termWidth, 80) * 2
  const desc = topic.description
    ? topic.description.length > maxDescLen
      ? topic.description.slice(0, maxDescLen).trimEnd() + '...'
      : topic.description
    : null

  return (
    <Box flexDirection="column" marginBottom={isLast ? 0 : 0}>
      <Box gap={1}>
        <Text color="cyan" bold>{topic.name}</Text>
        <Text dimColor>v{topic.version}</Text>
        <Text dimColor>·</Text>
        <Text dimColor>{topic.id}</Text>
        <Text dimColor>·</Text>
        <Text dimColor>{updatedAt}</Text>
      </Box>

      {desc && (
        <Box paddingLeft={2}>
          <Text dimColor wrap="wrap">{desc}</Text>
        </Box>
      )}
    </Box>
  )
}
