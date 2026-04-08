import React, { useEffect, useState } from 'react'
import { Box, Text, useApp } from 'ink'
import { gql } from '../lib/client.js'
import { getToken, getApiUrl } from '../lib/config.js'
import { Spinner } from '../components/Spinner.js'

type Status = 'pending' | 'running' | 'ok' | 'failed' | 'auth-failed'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default function Refresh() {
  const { exit } = useApp()
  const [status, setStatus] = useState<Status>('pending')
  const [error, setError] = useState<string | null>(null)
  const [batchId, setBatchId] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      setStatus('running')
      try {
        const result = await gql<{ refresh: string }>(
          'mutation Refresh { refresh(days: 1) }',
        )
        setBatchId(result.refresh)

        // Brief poll to catch instant pipeline failures (e.g. expired X auth)
        await sleep(3000)
        try {
          const token = getToken()
          const baseUrl = getApiUrl().replace(/\/graphql$/, '')
          const res = await fetch(`${baseUrl}/indexing/status`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const data = await res.json()
            if (data.pipeline?.status === 'failed' && data.pipeline?.steps?.length === 0) {
              setStatus('auth-failed')
              return
            }
          }
        } catch {
          // Poll failed — not critical, proceed normally
        }

        setStatus('ok')
      } catch (err) {
        setStatus('failed')
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  useEffect(() => {
    if (status === 'ok' || status === 'failed' || status === 'auth-failed') exit()
  }, [status])

  if (status === 'running') {
    return <Spinner label="Queuing refresh pipeline..." />
  }

  if (status === 'auth-failed') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="yellow">Pipeline failed — X authorization has likely expired.</Text>
        <Text dimColor>
          Re-connect your X account at <Text color="cyan">https://sonar.8640p.info/account</Text>
        </Text>
        <Text dimColor>
          Then run <Text color="cyan">sonar refresh</Text> to retry.
        </Text>
      </Box>
    )
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
      {batchId && <Text dimColor>batch: {batchId}</Text>}
      <Text dimColor>
        Run <Text color="cyan">sonar status --watch</Text> to monitor progress.
      </Text>
    </Box>
  )
}
