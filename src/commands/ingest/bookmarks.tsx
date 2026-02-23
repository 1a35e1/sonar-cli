import React, { useEffect, useRef, useState } from 'react'
import { Box, Text } from 'ink'
import { gql } from '../../lib/client.js'
import { Spinner } from '../../components/Spinner.js'
import { RefreshTip } from '../../components/RefreshTip.js'

/** How long (ms) to wait for the ingest mutation before giving up. */
const INGEST_TIMEOUT_MS = 15_000

export default function IndexBookmarks() {
  const [queued, setQueued] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const deadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Hard wall-clock timeout — catches cases where the gql call itself
    // hangs (e.g. server accepts the connection but never sends a response).
    deadlineRef.current = setTimeout(() => {
      setTimedOut(true)
      setError(
        `Ingest trigger timed out after ${INGEST_TIMEOUT_MS / 1000}s.\n` +
        'The server accepted the request but did not respond in time.\n' +
        'Next steps:\n' +
        '  • Run "sonar ingest monitor" — the job may still be queued\n' +
        '  • Check SONAR_API_URL points to the correct endpoint\n' +
        '  • Verify the server is healthy and retry'
      )
    }, INGEST_TIMEOUT_MS)

    async function run() {
      try {
        const res = await gql<{ indexBookmarks: boolean }>(`
          mutation IndexBookmarks {
            indexBookmarks
          }
        `)
        if (deadlineRef.current) clearTimeout(deadlineRef.current)
        setQueued(res.indexBookmarks)
      } catch (err) {
        if (deadlineRef.current) clearTimeout(deadlineRef.current)
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    run()
    return () => {
      if (deadlineRef.current) clearTimeout(deadlineRef.current)
    }
  }, [])

  if (error) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={timedOut ? 'yellow' : 'red'}>
          {timedOut ? '⚠ ' : 'Error: '}
          {error}
        </Text>
        {timedOut && (
          <Text dimColor>
            Tip: run <Text color="cyan">sonar ingest monitor</Text> to check
            whether the job was queued despite the timeout.
          </Text>
        )}
      </Box>
    )
  }

  if (queued === null) return <Spinner label="Triggering bookmark indexing..." />

  return (
    <Box flexDirection="column" gap={1}>
      <Text>
        <Text color="cyan">index_bookmarks: </Text>
        <Text>{queued ? '✓ queued' : '✗ failed to queue — check server logs'}</Text>
      </Text>
      {!queued && (
        <Text dimColor>
          The server returned false. Verify your API key and account status
          with <Text color="cyan">sonar account</Text>.
        </Text>
      )}
      <RefreshTip />
    </Box>
  )
}
