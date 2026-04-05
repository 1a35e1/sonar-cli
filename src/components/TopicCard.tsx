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

  return (
    <Box flexDirection="column" marginBottom={isLast ? 0 : 1} width={termWidth}>
      <Box>
        <Text color="cyan" bold>{topic.name}</Text>
        <Text dimColor>  v{topic.version} · {topic.id} · {updatedAt}</Text>
      </Box>

      {topic.description && (
        <Box>
          <Text color="gray">{'└'} </Text>
          <Text wrap="wrap">{topic.description}</Text>
        </Box>
      )}

      {!isLast && (
        <Box marginTop={1}>
          <Text dimColor>{'─'.repeat(Math.min(termWidth - 2, 72))}</Text>
        </Box>
      )}
    </Box>
  )
}
