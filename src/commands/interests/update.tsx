import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text } from 'ink'
import { gql } from '../../lib/client.js'
import { generateInterest } from '../../lib/ai.js'
import { getVendor } from '../../lib/config.js'
import { Spinner } from '../../components/Spinner.js'
import type { Interest } from './index.js'

export const options = zod.object({
  id: zod.string().describe('Interest ID to update'),
  name: zod.string().optional().describe('New name'),
  description: zod.string().optional().describe('New description'),
  keywords: zod.string().optional().describe('Comma-separated keywords (full replace)'),
  topics: zod.string().optional().describe('Comma-separated related topics (full replace)'),
  addKeywords: zod.string().optional().describe('Comma-separated keywords to add'),
  removeKeywords: zod.string().optional().describe('Comma-separated keywords to remove'),
  addTopics: zod.string().optional().describe('Comma-separated topics to add'),
  removeTopics: zod.string().optional().describe('Comma-separated topics to remove'),
  fromPrompt: zod.string().optional().describe('Regenerate all fields from a prompt'),
  vendor: zod.string().optional().describe('AI vendor: openai|anthropic'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
})

type Props = { options: zod.infer<typeof options> }

const QUERY = `
  query Interests {
    projects {
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

const UPDATE_MUTATION = `
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

async function fetchById(id: string): Promise<Interest> {
  const result = await gql<{ projects: Interest[] }>(QUERY)
  const found = result.projects.find((p) => p.id === id)
  if (!found) throw new Error(`Interest with id "${id}" not found`)
  return found
}

export default function InterestsUpdate({ options: flags }: Props) {
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
        const isPatch = !!(flags.addKeywords || flags.removeKeywords || flags.addTopics || flags.removeTopics)

        let name = flags.name
        let description = flags.description ?? null
        let keywords = flags.keywords ? flags.keywords.split(',').map((k) => k.trim()) : null
        let relatedTopics = flags.topics ? flags.topics.split(',').map((t) => t.trim()) : null

        if (isPatch) {
          const existing = await fetchById(flags.id)
          name = flags.name ?? existing.name
          description = flags.description ?? existing.description ?? null

          const addKw = flags.addKeywords ? flags.addKeywords.split(',').map((k) => k.trim()).filter(Boolean) : []
          const removeKw = flags.removeKeywords ? new Set(flags.removeKeywords.split(',').map((k) => k.trim())) : new Set<string>()
          const existingKw = existing.keywords ?? []
          keywords = [...new Set([...existingKw.filter((k: string) => !removeKw.has(k)), ...addKw])]

          const addT = flags.addTopics ? flags.addTopics.split(',').map((t) => t.trim()).filter(Boolean) : []
          const removeT = flags.removeTopics ? new Set(flags.removeTopics.split(',').map((t) => t.trim())) : new Set<string>()
          const existingT = existing.relatedTopics ?? []
          relatedTopics = [...new Set([...existingT.filter((t: string) => !removeT.has(t)), ...addT])]
        } else if (flags.fromPrompt) {
          const vendor = getVendor(flags.vendor)
          const generated = await generateInterest(flags.fromPrompt, vendor)
          name = generated.name
          description = generated.description
          keywords = generated.keywords
          relatedTopics = generated.relatedTopics
        }

        if (!name) {
          const existing = await fetchById(flags.id)
          name = existing.name
          if (!description) description = existing.description ?? null
          if (!keywords) keywords = existing.keywords ?? null
          if (!relatedTopics) relatedTopics = existing.relatedTopics ?? null
        }

        const result = await gql<{ createOrUpdateProject: Interest }>(UPDATE_MUTATION, {
          nanoId: flags.id,
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
      : 'Updating interest...'
    return <Spinner label={label} />
  }

  return (
    <Box flexDirection="column" gap={0}>
      <Box gap={2}>
        <Text bold color="cyan">{data.name}</Text>
        <Text dimColor>v{data.version} · {data.id} · updated</Text>
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
