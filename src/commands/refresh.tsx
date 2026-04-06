import React, { useEffect, useState } from 'react'
import { Box, Text, useApp } from 'ink'
import { gql } from '../lib/client.js'
import { Spinner } from '../components/Spinner.js'

type Status = 'pending' | 'running' | 'ok' | 'failed'

export default function Refresh() {
  const { exit } = useApp()
  const [status, setStatus] = useState<Status>('pending')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      setStatus('running')
      try {
        await gql<{ refresh: boolean }>(
          'mutation Refresh { refresh(days: 3) }',
        )
        setStatus('ok')
      } catch (err) {
        setStatus('failed')
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  useEffect(() => {
    if (status === 'ok' || status === 'failed') exit()
  }, [status])

  if (status === 'running') {
    return <Spinner label="Queuing refresh pipeline..." />
  }

  if (status === 'failed') {
    const isAuthError = error?.includes('Re-authorize') || error?.includes('not connected')
    if (isAuthError) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text color="yellow">X authorization required</Text>
          <Text dimColor>
            Connect your X account at <Text color="cyan">https://sonar.8640p.info/account</Text>
          </Text>
        </Box>
      )
    }
    return <Text color="red">Error: {error}</Text>
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="green">✓ Refresh pipeline queued</Text>
      <Text dimColor>
        graph → tweets → suggestions will run in order.{'\n'}
        Run <Text color="cyan">sonar status --watch</Text> to monitor progress.
      </Text>
    </Box>
  )
}
