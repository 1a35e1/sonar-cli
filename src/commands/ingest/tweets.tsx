import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { gql } from '../../lib/client.js'
import { Spinner } from '../../components/Spinner.js'
import { RefreshTip } from '../../components/RefreshTip.js'

export default function IndexTweets() {
  const [queued, setQueued] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        const res = await gql<{ indexTweets: boolean }>(`
          mutation IndexTweets {
            indexTweets
          }
        `)
        setQueued(res.indexTweets)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (queued === null) return <Spinner label="Triggering tweet indexing..." />

  return (
    <Box flexDirection="column" gap={1}>
      <Text>
        <Text color="cyan">index_tweets: </Text>
        <Text>{queued ? '✓ queued' : '✗ failed'}</Text>
      </Text>
      <RefreshTip />
    </Box>
  )
}
