import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text } from 'ink'
import { gql } from '../../lib/client.js'
import { Spinner } from '../../components/Spinner.js'
import type { Topic } from './index.js'

export const args = zod.tuple([
  zod.string().describe('Topic ID'),
])

type Props = { args: zod.infer<typeof args> }

const QUERY = `
  query Topics {
    topics {
      id: nanoId
      name
      description
      version
      createdAt
      updatedAt
    }
  }
`

export default function TopicView({ args: [id] }: Props) {
  const [data, setData] = useState<Topic | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        const result = await gql<{ topics: Topic[] }>(QUERY)
        const found = result.topics.find((p) => p.id === id)
        if (!found) throw new Error(`Topic "${id}" not found. Run: sonar topics`)
        setData(found)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!data) return <Spinner label="Loading topic..." />

  const updatedAt = new Date(data.updatedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text bold color="cyan">{data.name}</Text>
        <Text dimColor>v{data.version} · {data.id} · {updatedAt}</Text>
      </Box>

      {data.description && (
        <Box paddingLeft={2}>
          <Text wrap="wrap">{data.description}</Text>
        </Box>
      )}

      <Box flexDirection="column">
        <Text dimColor>edit: sonar topics edit {data.id} --name "new name"</Text>
        <Text dimColor>delete: sonar topics delete {data.id}</Text>
      </Box>
    </Box>
  )
}
