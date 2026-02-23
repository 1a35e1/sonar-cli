import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text } from 'ink'
import { gql } from '../../lib/client.js'
import { Spinner } from '../../components/Spinner.js'
import { Table } from '../../components/Table.js'
import { InteractiveInboxSession } from '../../components/InteractiveSession.js'
import { getVendor } from '../../lib/config.js'

export const options = zod.object({
  status: zod.string().optional().describe('Filter by status: inbox|later|replied|archived'),
  limit: zod.number().default(20).describe('Result limit'),
  all: zod.boolean().default(false).describe('Show all statuses'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
  interactive: zod.boolean().default(false).describe('Interactive session mode'),
  vendor: zod.string().optional().describe('AI vendor: openai|anthropic'),
})

type Props = { options: zod.infer<typeof options> }

export interface Suggestion {
  suggestionId: string
  score: number
  projectsMatched: number
  status: string
  relevance: number | null
  tweet: {
    xid: string
    text: string
    createdAt: string
    likeCount: number
    retweetCount: number
    user: {
      displayName: string
      username: string | null
    }
  }
}

const LIST_QUERY = `
  query Inbox($status: SuggestionStatus, $limit: Int) {
    suggestions(status: $status, limit: $limit) {
      suggestionId
      score
      projectsMatched
      status
      tweet {
        xid
        text
        createdAt
        user {
          displayName
          username
        }
      }
    }
  }
`

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function Inbox({ options: flags }: Props) {
  const [data, setData] = useState<Suggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        const status = flags.all ? null : (flags.status?.toUpperCase() ?? 'INBOX')
        const result = await gql<{ suggestions: Suggestion[] }>(LIST_QUERY, {
          status,
          limit: flags.limit,
        })

        if (flags.json) {
          if (result.suggestions.length === 0) {
            const statusLabel = flags.all ? 'all statuses' : (flags.status ?? 'inbox')
            process.stderr.write(
              [
                `[sonar inbox] Empty result for status=${statusLabel} — possible causes:`,
                '  • No interests defined. Run: sonar interests create --from-prompt "..."',
                '  • Ingest and matching have not run. Run: sonar ingest tweets && sonar interests match',
                '  • All inbox items were already actioned. Try: sonar inbox --all',
                '  • Account/quota issue. Run: sonar account',
              ].join('\n') + '\n'
            )
          }
          process.stdout.write(JSON.stringify(result.suggestions, null, 2) + '\n')
          process.exit(0)
        }

        setData(result.suggestions)
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
    return <Spinner label="Fetching inbox..." />
  }

  if (data.length === 0) {
    const statusLabel = flags.all ? 'all statuses' : (flags.status ?? 'inbox')
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="yellow">Inbox is empty{statusLabel !== 'all statuses' ? ` (status: ${statusLabel})` : ''}.</Text>
        <Box flexDirection="column" gap={0}>
          <Text dimColor>Things to check:</Text>
          {flags.status && !flags.all && (
            <Text dimColor>  1. Broaden scope:            <Text color="cyan">sonar inbox --all</Text></Text>
          )}
          <Text dimColor>  {flags.status && !flags.all ? '2' : '1'}. Interests defined?       <Text color="cyan">sonar interests</Text></Text>
          <Text dimColor>  {flags.status && !flags.all ? '3' : '2'}. Ingest recent tweets:    <Text color="cyan">sonar ingest tweets</Text></Text>
          <Text dimColor>  {flags.status && !flags.all ? '4' : '3'}. Run interest matching:   <Text color="cyan">sonar interests match</Text></Text>
          <Text dimColor>  {flags.status && !flags.all ? '5' : '4'}. Monitor job progress:    <Text color="cyan">sonar ingest monitor</Text></Text>
        </Box>
        <Text dimColor>
          Account status and quota: <Text color="cyan">sonar account</Text>
        </Text>
      </Box>
    )
  }

  if (flags.interactive) {
    return <InteractiveInboxSession items={data} vendor={getVendor(flags.vendor)} />
  }

  const rows = data.map((s) => ({
    id: s.suggestionId.slice(0, 8),
    score: s.score.toFixed(2),
    interests: s.projectsMatched,
    age: relativeTime(s.tweet.createdAt),
    author: `@${s.tweet.user.username ?? s.tweet.user.displayName}`,
    tweet: s.tweet.text.replace(/\n/g, ' ').slice(0, 80),
  }))

  const label = flags.all ? 'All' : (flags.status ? flags.status.toLowerCase() : 'Inbox')

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>{label}</Text>
        <Text dimColor> ({data.length})</Text>
      </Box>
      <Table rows={rows} columns={['id', 'score', 'interests', 'age', 'author', 'tweet']} />
    </Box>
  )
}
