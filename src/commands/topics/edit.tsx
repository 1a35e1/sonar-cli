import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text } from 'ink'
import { gql } from '../../lib/client.js'
import { Spinner } from '../../components/Spinner.js'
import type { Topic } from './index.js'

export const options = zod.object({
  id: zod.string().describe('Topic ID to update'),
  name: zod.string().optional().describe('New name'),
  description: zod.string().optional().describe('New description'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
})

type Props = { options: zod.infer<typeof options> }

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

const UPDATE_MUTATION = `
  mutation CreateOrUpdateTopic(
    $nanoId: String
    $name: String!
    $description: String
  ) {
    createOrUpdateTopic(input: {
      nanoId: $nanoId
      name: $name
      description: $description
    }) {
      id: nanoId
      name
      description
      version
      createdAt
      updatedAt
    }
  }
`

async function fetchById(id: string): Promise<Topic> {
  const result = await gql<{ topics: Topic[] }>(QUERY)
  const found = result.topics.find((p) => p.id === id)
  if (!found) throw new Error(`Topic with id "${id}" not found`)
  return found
}

export default function TopicEdit({ options: flags }: Props) {
  const [data, setData] = useState<Topic | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!error || !flags.json) return
    process.stderr.write(`${error}\n`)
    process.exit(1)
  }, [error, flags.json])

  useEffect(() => {
    async function run() {
      try {
        let name = flags.name
        let description = flags.description ?? null

        if (!name) {
          const existing = await fetchById(flags.id)
          name = existing.name
          if (!description) description = existing.description ?? null
        }

        const result = await gql<{ createOrUpdateTopic: Topic }>(UPDATE_MUTATION, {
          nanoId: flags.id,
          name,
          description,
        })

        if (flags.json) {
          process.stdout.write(JSON.stringify(result.createOrUpdateTopic, null, 2) + '\n')
          process.exit(0)
        }

        setData(result.createOrUpdateTopic)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  if (error) {
    if (flags.json) return <></>
    return <Text color="red">Error: {error}</Text>
  }

  if (!data) {
    if (flags.json) return <></>
    return <Spinner label="Updating topic..." />
  }

  return (
    <Box flexDirection="column" gap={0}>
      <Box gap={2}>
        <Text bold color="cyan">{data.name}</Text>
        <Text dimColor>v{data.version} · {data.id} · updated</Text>
      </Box>
      {data.description && <Text dimColor>{data.description}</Text>}
    </Box>
  )
}
