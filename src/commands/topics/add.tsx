import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text } from 'ink'
import { gql } from '../../lib/client.js'
import { validateTopicName, validateDescription } from '../../lib/validation.js'
import { Spinner } from '../../components/Spinner.js'
import type { Topic } from './index.js'

export const args = zod.tuple([
  zod.string().describe('Topic name or phrase'),
])

export const options = zod.object({
  description: zod.string().optional().describe('Optional description (auto-generated if omitted)'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
})

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> }

const CREATE_MUTATION = `
  mutation CreateOrUpdateTopic(
    $name: String!
    $description: String
  ) {
    createOrUpdateTopic(input: {
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

export default function TopicsAdd({ args: [name], options: flags }: Props) {
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
        const nameErr = validateTopicName(name)
        if (nameErr) { setError(nameErr); return }

        if (flags.description !== undefined) {
          const descErr = validateDescription(flags.description)
          if (descErr) { setError(descErr); return }
        }

        const result = await gql<{ createOrUpdateTopic: Topic }>(CREATE_MUTATION, {
          name,
          description: flags.description ?? null,
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
    return <Spinner label="Creating topic (expanding via AI)..." />
  }

  return (
    <Box flexDirection="column" gap={0}>
      <Box gap={2}>
        <Text bold color="cyan">{data.name}</Text>
        <Text dimColor>v{data.version} · {data.id} · created</Text>
      </Box>
      {data.description && <Text dimColor>{data.description}</Text>}
      <Box marginTop={1}>
        <Text dimColor>tip  run </Text>
        <Text color="cyan">sonar refresh</Text>
        <Text dimColor> to match this topic against recent tweets</Text>
      </Box>
    </Box>
  )
}
