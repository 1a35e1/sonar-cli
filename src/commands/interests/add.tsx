import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text } from 'ink'
import { gql } from '../../lib/client.js'
import { generateInterest, OPENAI_TIMEOUT_MS, ANTHROPIC_TIMEOUT_MS } from '../../lib/ai.js'
import { getVendor } from '../../lib/config.js'
import { Spinner } from '../../components/Spinner.js'
import type { Interest } from './index.js'

export const options = zod.object({
  prompt: zod.string().optional().describe('Natural language prompt to generate interest'),
  name: zod.string().optional().describe('Interest name (manual)'),
  description: zod.string().optional().describe('Description (manual)'),
  keywords: zod.string().optional().describe('Comma-separated keywords (manual)'),
  topics: zod.string().optional().describe('Comma-separated topics (manual)'),
  vendor: zod.string().optional().describe('AI vendor: openai|anthropic'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
})

type Props = { options: zod.infer<typeof options> }

const CREATE_MUTATION = `
  mutation CreateOrUpdateInterest(
    $nanoId: String
    $name: String!
    $description: String
    $keywords: [String!]
    $relatedTopics: [String!]
  ) {
    createOrUpdateProject(input: {
      nanoId: $nanoId
      name: $name
      description: $description
      keywords: $keywords
      relatedTopics: $relatedTopics
    }) {
      id: nanoId
      name
      description
      keywords
      relatedTopics
      version
      createdAt
      updatedAt
    }
  }
`

export default function InterestsAdd({ options: flags }: Props) {
  const [data, setData] = useState<Interest | null>(null)
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
        let keywords = flags.keywords ? flags.keywords.split(',').map((k) => k.trim()) : null
        let relatedTopics = flags.topics ? flags.topics.split(',').map((t) => t.trim()) : null

        if (flags.prompt) {
          const vendor = getVendor(flags.vendor)
          const generated = await generateInterest(flags.prompt, vendor)
          name = generated.name
          description = generated.description
          keywords = generated.keywords
          relatedTopics = generated.relatedTopics
        }

        if (!name) {
          setError('--prompt or --name is required')
          return
        }

        const result = await gql<{ createOrUpdateProject: Interest }>(CREATE_MUTATION, {
          nanoId: null,
          name,
          description,
          keywords,
          relatedTopics,
        })

        if (flags.json) {
          process.stdout.write(JSON.stringify(result.createOrUpdateProject, null, 2) + '\n')
          process.exit(0)
        }

        setData(result.createOrUpdateProject)
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
    const vendor = getVendor(flags.vendor)
    const timeoutSec = (vendor === 'openai' ? OPENAI_TIMEOUT_MS : ANTHROPIC_TIMEOUT_MS) / 1000
    const label = flags.prompt
      ? `Generating interest via ${vendor}... (up to ${timeoutSec}s${vendor === 'openai' ? ' with web search' : ''})`
      : 'Creating interest...'
    return <Spinner label={label} />
  }

  return (
    <Box flexDirection="column" gap={0}>
      <Box gap={2}>
        <Text bold color="cyan">{data.name}</Text>
        <Text dimColor>v{data.version} · {data.id} · created</Text>
      </Box>
      {data.description && <Text dimColor>{data.description}</Text>}
      {data.keywords && data.keywords.length > 0 && (
        <Box gap={1}>
          <Text dimColor>keywords:</Text>
          <Text>{data.keywords.join(', ')}</Text>
        </Box>
      )}
      {data.relatedTopics && data.relatedTopics.length > 0 && (
        <Box gap={1}>
          <Text dimColor>topics:  </Text>
          <Text>{data.relatedTopics.join(', ')}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>tip  run </Text>
        <Text color="cyan">sonar refresh</Text>
        <Text dimColor> to match this interest against recent tweets</Text>
      </Box>
    </Box>
  )
}
