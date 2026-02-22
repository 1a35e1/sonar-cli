import React from 'react'
import { Box, Text } from 'ink'
import { formatDistanceToNow } from 'date-fns'

export interface Account {
  accountId: string
  email: string | null
  xHandle: string
  xid: string
  isPayingCustomer: boolean
  indexingAccounts: number
  indexedTweets: number
  pendingEmbeddings: number
  twitterIndexedAt: string | null
  refreshedSuggestionsAt: string | null
}

interface Props {
  me: Account
}

export function AccountCard({ me }: Props) {
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Account</Text>
      <Text><Text dimColor>handle: </Text>@{me.xHandle}</Text>
      {me.email && <Text><Text dimColor>email: </Text>{me.email}</Text>}
      <Text><Text dimColor>plan: </Text>{me.isPayingCustomer ? 'Pro' : 'Free'}</Text>
      <Text><Text dimColor>indexing accounts: </Text>{me.indexingAccounts}</Text>
      <Text><Text dimColor>indexed tweets: </Text>{me.indexedTweets.toLocaleString()}</Text>
      <Text>
        <Text dimColor>embeddings queue: </Text>
        <Text color={me.pendingEmbeddings > 0 ? 'yellow' : 'green'}>{me.pendingEmbeddings}</Text>
      </Text>
      {me.twitterIndexedAt && (
        <Text>
          <Text dimColor>last indexed: </Text>
          {formatDistanceToNow(new Date(me.twitterIndexedAt), { addSuffix: true })}
        </Text>
      )}
      {me.refreshedSuggestionsAt && (
        <Text>
          <Text dimColor>suggestions refreshed: </Text>
          {formatDistanceToNow(new Date(me.refreshedSuggestionsAt), { addSuffix: true })}
        </Text>
      )}
    </Box>
  )
}
