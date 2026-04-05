import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text } from 'ink'
import { gql } from '../../lib/client.js'
import { Spinner } from '../../components/Spinner.js'
import { RefreshTip } from '../../components/RefreshTip.js'

export const options = zod.object({
  days: zod.number().optional().describe('Tweet window in days (default: 1, capped by plan)'),
})

type Props = { options: zod.infer<typeof options> }

export default function InterestsMatch({ options: flags }: Props) {
  const [queued, setQueued] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        const res = await gql<{ regenerateSuggestions: boolean }>(
          `mutation RegenerateSuggestions($days: Int) {
            regenerateSuggestions(days: $days)
          }`,
          { days: flags.days ?? 1 },
        )
        setQueued(res.regenerateSuggestions)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (queued === null) return <Spinner label="Matching interests against tweets..." />

  return (
    <Box flexDirection="column" gap={1}>
      <Text>
        <Text color="cyan">interests match: </Text>
        <Text>{queued ? '✓ queued' : '✗ failed'}</Text>
      </Text>
      <RefreshTip />
    </Box>
  )
}
