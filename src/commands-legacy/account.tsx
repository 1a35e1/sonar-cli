import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text } from 'ink'
import { formatDistanceToNow } from 'date-fns'
import { gql } from '../lib/client.js'
import { Spinner } from '../components/Spinner.js'
import { AccountCard } from '../components/AccountCard.js'
import type { Account } from '../components/AccountCard.js'

export const options = zod.object({
  json: zod.boolean().default(false).describe('Raw JSON output'),
  debug: zod.boolean().default(false).describe('Debug mode'),
})

type Props = { options: zod.infer<typeof options> }


interface SuggestionCounts {
  inbox: number
  later: number
  replied: number
  read: number
  skipped: number
  archived: number
  total: number
}

interface DimensionUsage {
  used: number
  limit: number | null
  atLimit: boolean
}

interface SuggestionRefreshUsage {
  used: number
  limit: number | null
  atLimit: boolean
  resetsAt: string | null
}

interface Usage {
  plan: string
  interests: DimensionUsage
  apiKeys: DimensionUsage
  bookmarksEnabled: boolean
  socialGraphDegrees: number
  socialGraphMaxUsers: number | null
  suggestionRefreshes: SuggestionRefreshUsage
}

interface StatusData {
  me: Account | null
  suggestionCounts: SuggestionCounts
  usage: Usage | null
}

const QUERY = `
  query Status {
    me {
      accountId
      email
      xHandle
      xid
      isPayingCustomer
      indexingAccounts
      indexedTweets
      pendingEmbeddings
      twitterIndexedAt
      refreshedSuggestionsAt
    }
    suggestionCounts {
      inbox
      later
      replied
      read
      skipped
      archived
      total
    }
    usage {
      plan
      interests { used limit atLimit }
      apiKeys { used limit atLimit }
      bookmarksEnabled
      socialGraphDegrees
      socialGraphMaxUsers
      suggestionRefreshes { used limit atLimit resetsAt }
    }
  }
`

export default function Account({ options: flags }: Props) {
  const [data, setData] = useState<StatusData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        const result = await gql<StatusData>(QUERY, {}, { debug: flags.debug })

        if (flags.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n')
          process.exit(0)
        }

        setData(result)
      } catch (err) {
        if (flags.debug) {
          console.error(JSON.stringify(err, null, 2))
        }
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!data) return <Spinner label="Fetching account..." />

  const { me, suggestionCounts, usage } = data

  return (
    <Box flexDirection="column" gap={1}>
      {me ? <AccountCard me={me} /> : (
        <Box flexDirection="column">
          <Text bold color="cyan">Account</Text>
          <Text dimColor>Not authenticated</Text>
        </Box>
      )}

      {usage && (
        <Box flexDirection="column">
          <Text bold color="cyan">Plan</Text>
          <Text>
            <Text dimColor>plan: </Text>
            <Text color={usage.plan === 'free' ? 'yellow' : 'green'}>{usage.plan}</Text>
          </Text>
          <Text>
            <Text dimColor>interests: </Text>
            <Text color={usage.interests.atLimit ? 'red' : undefined}>
              {usage.interests.used}{usage.interests.limit !== null ? `/${usage.interests.limit}` : ''}
            </Text>
          </Text>
          <Text>
            <Text dimColor>api keys: </Text>
            <Text color={usage.apiKeys.atLimit ? 'red' : undefined}>
              {usage.apiKeys.used}{usage.apiKeys.limit !== null ? `/${usage.apiKeys.limit}` : ''}
            </Text>
          </Text>
          <Text>
            <Text dimColor>bookmarks: </Text>
            {usage.bookmarksEnabled ? <Text color="green">enabled</Text> : <Text dimColor>upgrade to unlock</Text>}
          </Text>
          <Text>
            <Text dimColor>social graph: </Text>
            {usage.socialGraphDegrees} degree{usage.socialGraphDegrees !== 1 ? 's' : ''}
            {usage.socialGraphMaxUsers !== null ? `, up to ${usage.socialGraphMaxUsers.toLocaleString()} users` : ', unlimited'}
          </Text>
          <Text>
            <Text dimColor>suggestion refreshes: </Text>
            {usage.suggestionRefreshes.limit !== null ? (
              <>
                <Text color={usage.suggestionRefreshes.atLimit ? 'red' : undefined}>
                  {usage.suggestionRefreshes.used}/{usage.suggestionRefreshes.limit}
                </Text>
                {usage.suggestionRefreshes.resetsAt && (
                  <Text dimColor>
                    {' '}(resets {formatDistanceToNow(new Date(usage.suggestionRefreshes.resetsAt), { addSuffix: true })})
                  </Text>
                )}
              </>
            ) : (
              <Text color="green">unlimited</Text>
            )}
          </Text>
        </Box>
      )}

      <Box flexDirection="column">
        <Text bold color="cyan">Suggestions</Text>
        <Text><Text dimColor>inbox: </Text><Text color={suggestionCounts.inbox > 0 ? 'green' : undefined}>{suggestionCounts.inbox}</Text></Text>
        <Text><Text dimColor>later: </Text>{suggestionCounts.later}</Text>
        <Text><Text dimColor>replied: </Text>{suggestionCounts.replied}</Text>
        <Text><Text dimColor>archived: </Text>{suggestionCounts.archived}</Text>
        <Text><Text dimColor>total: </Text>{suggestionCounts.total}</Text>
      </Box>
    </Box>
  )
}
