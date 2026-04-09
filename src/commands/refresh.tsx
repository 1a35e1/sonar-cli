import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Box, Text, useApp } from 'ink'
import { gql, RateLimitError } from '../lib/client.js'
import { getToken, getApiUrl } from '../lib/config.js'
import { Spinner } from '../components/Spinner.js'

export const options = zod.object({
  bookmarks: zod.boolean().default(false).describe('Sync bookmarks from X'),
  likes: zod.boolean().default(false).describe('Sync likes from X'),
  graph: zod.boolean().default(false).describe('Rebuild social graph'),
  tweets: zod.boolean().default(false).describe('Index tweets across network'),
  suggestions: zod.boolean().default(false).describe('Regenerate suggestions'),
  wait: zod.boolean().default(false).describe('Auto-retry after rate limit resets (shows countdown)'),
})

type Props = { options: zod.infer<typeof options> }

type Status = 'pending' | 'running' | 'ok' | 'failed' | 'auth-failed' | 'rate-limited'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const REFRESH_MUTATION = `
  mutation Refresh($days: Int!, $steps: [String!]) {
    refresh(days: $days, steps: $steps)
  }
`

export default function Refresh({ options: flags }: Props) {
  const { exit } = useApp()
  const [status, setStatus] = useState<Status>('pending')
  const [error, setError] = useState<string | null>(null)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [rateLimitResetAt, setRateLimitResetAt] = useState<Date | null>(null)

  // Build steps array from flags — null means run all
  const selectedSteps: string[] = []
  if (flags.bookmarks) selectedSteps.push('bookmarks')
  if (flags.likes) selectedSteps.push('likes')
  if (flags.graph) selectedSteps.push('graph')
  if (flags.tweets) selectedSteps.push('tweets')
  if (flags.suggestions) selectedSteps.push('suggestions')
  const steps = selectedSteps.length > 0 ? selectedSteps : null

  useEffect(() => {
    async function run() {
      setStatus('running')
      try {
        const result = await gql<{ refresh: string }>(REFRESH_MUTATION, {
          days: 1,
          steps,
        }, { wait: flags.wait })
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
            if (data.pipeline?.status === 'failed') {
              const pipelineError = data.pipeline?.error ?? ''
              setError(pipelineError)
              setStatus('auth-failed')
              return
            }
          }
        } catch {
          // Poll failed — not critical, proceed normally
        }

        setStatus('ok')
      } catch (err) {
        if (err instanceof RateLimitError) {
          setRateLimitResetAt(err.resetAt)
          setStatus('rate-limited')
        } else {
          setStatus('failed')
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }
    run()
  }, [])

  useEffect(() => {
    if (status === 'ok' || status === 'failed' || status === 'auth-failed' || status === 'rate-limited') exit()
  }, [status])

  const label = steps ? steps.join(', ') : 'full pipeline'

  if (status === 'running') {
    return <Spinner label={`Queuing refresh (${label})...`} />
  }

  if (status === 'auth-failed') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="red">Pipeline failed{error ? `: ${error}` : ''}</Text>
        <Text dimColor>
          Re-connect your X account at <Text color="cyan">https://sonar.8640p.info/account</Text>
        </Text>
        <Text dimColor>
          Then run <Text color="cyan">sonar refresh</Text> to retry.
        </Text>
      </Box>
    )
  }

  if (status === 'rate-limited') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="yellow">X API rate limit reached</Text>
        {rateLimitResetAt && (
          <Text dimColor>Resets at <Text color="cyan">{rateLimitResetAt.toUTCString()}</Text></Text>
        )}
        <Text dimColor>
          Run <Text color="cyan">sonar refresh --wait</Text> to auto-retry when the limit resets.
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
      <Text color="green">✓ Refresh queued ({label})</Text>
      {batchId && <Text dimColor>batch: {batchId}</Text>}
      <Text dimColor>
        Run <Text color="cyan">sonar status --watch</Text> to monitor progress.
      </Text>
    </Box>
  )
}
