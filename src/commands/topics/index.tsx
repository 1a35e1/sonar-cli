import React, { useEffect, useState } from 'react'
import { Box, Text, useStdout } from 'ink'
import { gql } from '../../lib/client.js'
import { Spinner } from '../../components/Spinner.js'
import { TopicCard } from '../../components/TopicCard.js'

type Props = {
  options: {
    json: boolean
  }
}

export interface Topic {
  id: string
  name: string
  description: string | null
  version: number
  createdAt: string
  updatedAt: string
}

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

export default function Topics({ options: flags }: Props) {
  const [data, setData] = useState<Topic[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 100

  useEffect(() => {
    async function run() {
      try {
        const result = await gql<{ topics: Topic[] }>(QUERY)

        if (flags.json) {
          process.stdout.write(JSON.stringify(result.topics, null, 2) + '\n')
          process.exit(0)
        }

        setData(result.topics)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  if (error) {
    return <Text color="red">Error: {error}</Text>
  }

  if (!data) {
    return <Spinner label="Fetching topics..." />
  }

  if (data.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text>No topics found. Add one:</Text>
        <Box flexDirection="column">
          <Text dimColor>  sonar topics add "AI agents"</Text>
          <Text dimColor>  sonar topics add "Rust and systems programming"</Text>
          <Text dimColor>  sonar topics add "DeFi protocols"</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text bold>Topics</Text>
        <Text dimColor> ({data.length})</Text>
      </Box>

      {data.map((p, i) => (
        <TopicCard
          key={p.id}
          topic={p}
          termWidth={termWidth}
          isLast={i === data.length - 1}
        />
      ))}

      <Text dimColor>view: sonar topics view &lt;id&gt; · edit: sonar topics edit &lt;id&gt; --name "new name"</Text>
    </Box>
  )
}
