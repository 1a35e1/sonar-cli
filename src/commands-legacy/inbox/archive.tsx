import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Text } from 'ink'
import { gql } from '../../lib/client.js'
import { Spinner } from '../../components/Spinner.js'

export const options = zod.object({
  id: zod.string().describe('Suggestion ID to archive'),
})

type Props = { options: zod.infer<typeof options> }

const UPDATE_MUTATION = `
  mutation UpdateSuggestion($suggestionId: ID!, $status: SuggestionStatus!) {
    updateSuggestion(input: { suggestionId: $suggestionId, status: $status }) {
      suggestionId
      status
    }
  }
`

export default function InboxArchive({ options: flags }: Props) {
  const [result, setResult] = useState<{ suggestionId: string; status: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        const res = await gql<{ updateSuggestion: { suggestionId: string; status: string } }>(UPDATE_MUTATION, {
          suggestionId: flags.id,
          status: 'ARCHIVED',
        })
        setResult(res.updateSuggestion)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!result) return <Spinner label="Updating..." />

  return (
    <Text>
      <Text dimColor>{result.suggestionId.slice(0, 8)}</Text>
      {' → '}
      <Text color="green">{result.status.toLowerCase()}</Text>
    </Text>
  )
}
