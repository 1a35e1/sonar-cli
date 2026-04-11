import React from 'react'
import { Box, Text } from 'ink'
import type { Topic } from '../commands/topics/index.js'

interface TopicCardProps {
  topic: Topic
  termWidth: number
  isLast: boolean
}

export function TopicCard({ topic }: TopicCardProps) {
  const updatedAt = new Date(topic.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Box gap={1}>
      <Text dimColor>{topic.id}</Text>
      <Text color="cyan" bold>{topic.name}</Text>
      <Text dimColor>v{topic.version} · {updatedAt}</Text>
    </Box>
  )
}
