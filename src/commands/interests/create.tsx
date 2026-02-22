import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text } from 'ink'
import { gql } from '../../lib/client.js'
import { generateInterest } from '../../lib/ai.js'
import { getVendor } from '../../lib/config.js'
import { Spinner } from '../../components/Spinner.js'
import type { Interest } from './index.js'

export const options = zod.object({
  name: zod.string().optional().describe('Interest name'),
  description: zod.string().optional().describe('Interest description'),
  keywords: zod.string().optional().describe('Comma-separated keywords'),
  topics: zod.string().optional().describe('Comma-separated related topics'),
  fromPrompt: zod.string().optional().describe('Generate fields from a natural language prompt'),
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

export default function InterestsCreate({ options: flags }: Props) {
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

        if (flags.fromPrompt) {
          const vendor = getVendor(flags.vendor)
          const generated = await generateInterest(flags.fromPrompt, vendor)
          name = generated.name
          description = generated.description
          keywords = generated.keywords
          relatedTopics = generated.relatedTopics
        }

        if (!name) {
          setError('--name or --from-prompt is required')
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
    const label = flags.fromPrompt
      ? `Generating interest via ${getVendor(flags.vendor)}...`
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
    </Box>
  )
}
