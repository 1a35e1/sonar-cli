import React from 'react'
import { Box, Text } from 'ink'
import type { Interest } from '../commands/interests/index.js'

interface InterestCardProps {
  interest: Interest
  termWidth: number
  isLast: boolean
}

export function InterestCard({ interest, termWidth, isLast }: InterestCardProps) {
  const updatedAt = new Date(interest.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Box flexDirection="column" marginBottom={isLast ? 0 : 1} width={termWidth}>
      <Box>
        <Text color="cyan" bold>{interest.name}</Text>
        <Text dimColor>  v{interest.version} · {interest.id} · {updatedAt}</Text>
      </Box>

      {interest.description && (
        <Box>
          <Text color="gray">{'└'} </Text>
          <Text wrap="wrap">{interest.description}</Text>
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
