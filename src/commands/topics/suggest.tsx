import React, { useCallback, useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { gql } from '../../lib/client.js'
import { getVendor } from '../../lib/config.js'
import { generateTopicSuggestions } from '../../lib/ai.js'
import type { GeneratedInterest } from '../../lib/ai.js'
import { Spinner } from '../../components/Spinner.js'
import type { Topic } from './index.js'

type Props = {
  options: {
    vendor?: string
    count?: number
    json: boolean
  }
}

const TOPICS_QUERY = `
  query Topics {
    topics { id: nanoId name description }
  }
`

const FEED_QUERY = `
  query Feed($hours: Int, $limit: Int) {
    feed(hours: $hours, limit: $limit) {
      tweet { text }
    }
  }
`

const CREATE_MUTATION = `
  mutation CreateOrUpdateTopic($name: String!, $description: String) {
    createOrUpdateTopic(input: { name: $name, description: $description }) {
      id: nanoId name description version createdAt updatedAt
    }
  }
`

type Phase = 'loading' | 'suggesting' | 'reviewing' | 'done'

export default function TopicsSuggest({ options: flags }: Props) {
  const vendor = getVendor(flags.vendor)
  const count = flags.count ?? 5

  const [phase, setPhase] = useState<Phase>('loading')
  const [suggestions, setSuggestions] = useState<GeneratedInterest[]>([])
  const [index, setIndex] = useState(0)
  const [accepted, setAccepted] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Phase 1: Fetch context, Phase 2: Generate suggestions
  useEffect(() => {
    async function run() {
      try {
        const [topicsRes, feedRes] = await Promise.all([
          gql<{ topics: Topic[] }>(TOPICS_QUERY),
          gql<{ feed: { tweet: { text: string } }[] }>(FEED_QUERY, { hours: 24, limit: 15 }),
        ])

        const existingNames = topicsRes.topics.map(t => t.name)
        const tweetTexts = feedRes.feed.map(f => f.tweet.text)

        setPhase('suggesting')

        const results = await generateTopicSuggestions(existingNames, tweetTexts, count, vendor)

        if (flags.json) {
          process.stdout.write(JSON.stringify(results, null, 2) + '\n')
          process.exit(0)
        }

        setSuggestions(results)
        setPhase('reviewing')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  const current = suggestions[index]

  const acceptCurrent = useCallback(async () => {
    if (!current || saving) return
    setSaving(true)
    try {
      await gql<{ createOrUpdateTopic: Topic }>(CREATE_MUTATION, {
        name: current.name,
        description: current.description,
      })
      setAccepted(prev => [...prev, current.name])
    } catch (err) {
      process.stderr.write(`Failed to save "${current.name}": ${err instanceof Error ? err.message : String(err)}\n`)
    }
    setSaving(false)
    if (index + 1 >= suggestions.length) {
      setPhase('done')
    } else {
      setIndex(i => i + 1)
    }
  }, [current, index, suggestions.length, saving])

  const skipCurrent = useCallback(() => {
    if (saving) return
    if (index + 1 >= suggestions.length) {
      setPhase('done')
    } else {
      setIndex(i => i + 1)
    }
  }, [index, suggestions.length, saving])

  useInput((input) => {
    if (phase !== 'reviewing') return
    if (input === 'y') acceptCurrent()
    else if (input === 'n') skipCurrent()
    else if (input === 'q') setPhase('done')
  }, { isActive: phase === 'reviewing' && !saving })

  if (error) return <Text color="red">Error: {error}</Text>

  if (phase === 'loading') {
    return <Spinner label="Analyzing your interests and feed..." />
  }

  if (phase === 'suggesting') {
    return <Spinner label={`Generating ${count} topic suggestions via ${vendor}...`} />
  }

  if (phase === 'done') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="green">
          {accepted.length > 0
            ? `Added ${accepted.length} topic${accepted.length === 1 ? '' : 's'}`
            : 'No topics added'}
        </Text>
        {accepted.map(name => (
          <Text key={name} dimColor>  + {name}</Text>
        ))}
        {accepted.length > 0 && (
          <Box marginTop={1}>
            <Text dimColor>tip  run </Text>
            <Text color="cyan">sonar refresh</Text>
            <Text dimColor> to match new topics against recent tweets</Text>
          </Box>
        )}
      </Box>
    )
  }

  // Phase: reviewing
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text dimColor>[{index + 1}/{suggestions.length}]</Text>
        {accepted.length > 0 && <Text color="green">  {accepted.length} accepted</Text>}
      </Box>

      <Box flexDirection="column" gap={0}>
        <Text bold color="cyan">{current.name}</Text>
        {current.description && (
          <Box marginTop={1} paddingLeft={2}>
            <Text wrap="wrap">{current.description.slice(0, 300)}{current.description.length > 300 ? '...' : ''}</Text>
          </Box>
        )}
        {current.keywords.length > 0 && (
          <Box marginTop={1} paddingLeft={2}>
            <Text dimColor>keywords  </Text>
            <Text color="yellow">{current.keywords.slice(0, 10).join('  ')}</Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1} gap={3}>
        {saving ? (
          <Spinner label="Saving..." />
        ) : (
          <>
            <Text dimColor><Text color="white">y</Text> accept</Text>
            <Text dimColor><Text color="white">n</Text> skip</Text>
            <Text dimColor><Text color="white">q</Text> quit</Text>
          </>
        )}
      </Box>
    </Box>
  )
}
