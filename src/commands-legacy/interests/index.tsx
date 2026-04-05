import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text, useStdout } from 'ink'
import { gql } from '../../lib/client.js'
import { Spinner } from '../../components/Spinner.js'
import { InterestCard } from '../../components/InterestCard.js'

export const options = zod.object({
  json: zod.boolean().default(false).describe('Raw JSON output'),
})

type Props = { options: zod.infer<typeof options> }

export interface Interest {
  id: string
  name: string
  description: string | null
  keywords: string[] | null
  relatedTopics: string[] | null
  version: number
  createdAt: string
  updatedAt: string
}

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

export default function Interests({ options: flags }: Props) {
  const [data, setData] = useState<Interest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 100

  useEffect(() => {
    async function run() {
      try {
        const result = await gql<{ projects: Interest[] }>(QUERY)

        if (flags.json) {
          process.stdout.write(JSON.stringify(result.projects, null, 2) + '\n')
          process.exit(0)
        }

        setData(result.projects)
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
    return <Spinner label="Fetching interests..." />
  }

  if (data.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text>No interests found. Create one from a prompt:</Text>
        <Box flexDirection="column">
          <Text dimColor>  sonar interests create --from-prompt "I want to follow the AI agents ecosystem"</Text>
          <Text dimColor>  sonar interests create --from-prompt "Rust and systems programming" --vendor anthropic</Text>
          <Text dimColor>  sonar interests create --from-prompt "DeFi protocols and on-chain finance"</Text>
          <Text dimColor>  sonar interests create --from-prompt "Climate tech and carbon markets"</Text>
        </Box>
        <Text dimColor>Or manually: sonar interests create --name "My Interest" --keywords "kw1,kw2" --topics "topic1"</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text bold>Interests</Text>
        <Text dimColor> ({data.length})</Text>
      </Box>

      {data.map((p, i) => (
        <InterestCard
          key={p.id}
          interest={p}
          termWidth={termWidth}
          isLast={i === data.length - 1}
        />
      ))}

      <Text dimColor>tip: --json for raw output · match: sonar interests match --days 3 · update: sonar interests update --id &lt;id&gt; --from-prompt "..."</Text>
    </Box>
  )
}
