import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { gql } from '../lib/client.js'
import { Spinner } from '../components/Spinner.js'

const INGEST_TIMEOUT_MS = 15_000

type StepStatus = 'pending' | 'running' | 'ok' | 'failed' | 'timeout'

interface Step {
  label: string
  status: StepStatus
  note?: string
}

function StepLine({ step }: { step: Step }) {
  const icon =
    step.status === 'ok' ? <Text color="green">✓</Text>
    : step.status === 'failed' ? <Text color="red">✗</Text>
    : step.status === 'timeout' ? <Text color="yellow">⚠</Text>
    : step.status === 'running' ? <Text color="cyan">…</Text>
    : <Text dimColor>·</Text>

  return (
    <Box gap={2}>
      {icon}
      <Text color={step.status === 'pending' ? undefined : 'white'}>{step.label}</Text>
      {step.note && <Text dimColor>{step.note}</Text>}
    </Box>
  )
}

async function triggerWithTimeout<T>(
  mutation: string,
  key: string,
): Promise<{ result: T | null; timedOut: boolean; error: string | null }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ result: null, timedOut: true, error: 'timed out' })
    }, INGEST_TIMEOUT_MS)

    gql<Record<string, T>>(mutation)
      .then((res) => {
        clearTimeout(timer)
        resolve({ result: res[key], timedOut: false, error: null })
      })
      .catch((err) => {
        clearTimeout(timer)
        resolve({ result: null, timedOut: false, error: err instanceof Error ? err.message : String(err) })
      })
  })
}

export default function Refresh() {
  const [steps, setSteps] = useState<Step[]>([
    { label: 'ingest tweets', status: 'pending' },
    { label: 'ingest bookmarks', status: 'pending' },
    { label: 'match interests', status: 'pending' },
  ])
  const [done, setDone] = useState(false)

  function updateStep(index: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  useEffect(() => {
    async function run() {
      // Step 1 — ingest tweets
      updateStep(0, { status: 'running' })
      const tweets = await triggerWithTimeout<boolean>(
        'mutation IndexTweets { indexTweets }',
        'indexTweets',
      )
      updateStep(0, {
        status: tweets.timedOut ? 'timeout' : tweets.error ? 'failed' : tweets.result ? 'ok' : 'failed',
        note: tweets.timedOut ? 'may still be queued' : tweets.error ?? undefined,
      })

      // Step 2 — ingest bookmarks
      updateStep(1, { status: 'running' })
      const bookmarks = await triggerWithTimeout<boolean>(
        'mutation IndexBookmarks { indexBookmarks }',
        'indexBookmarks',
      )
      updateStep(1, {
        status: bookmarks.timedOut ? 'timeout' : bookmarks.error ? 'failed' : bookmarks.result ? 'ok' : 'failed',
        note: bookmarks.timedOut ? 'may still be queued' : bookmarks.error ?? undefined,
      })

      // Step 3 — match interests
      updateStep(2, { status: 'running' })
      const match = await triggerWithTimeout<boolean>(
        'mutation RegenerateSuggestions { regenerateSuggestions(days: 1) }',
        'regenerateSuggestions',
      )
      updateStep(2, {
        status: match.timedOut ? 'timeout' : match.error ? 'failed' : match.result ? 'ok' : 'failed',
        note: match.timedOut ? 'may still be queued' : match.error ?? undefined,
      })

      setDone(true)
    }
    run()
  }, [])

  const allDone = steps.every((s) => s.status !== 'pending' && s.status !== 'running')
  const anyFailed = steps.some((s) => s.status === 'failed' || s.status === 'timeout')

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        {steps.map((step, i) => <StepLine key={i} step={step} />)}
      </Box>
      {done && (
        <Box flexDirection="column">
          {anyFailed ? (
            <Text dimColor>
              Some steps failed. Check <Text color="cyan">sonar status</Text> for queue details.
            </Text>
          ) : (
            <Text dimColor>
              Pipeline refresh queued. Run <Text color="cyan">sonar status --watch</Text> to monitor progress.
            </Text>
          )}
        </Box>
      )}
      {!allDone && <Spinner label="Running..." />}
    </Box>
  )
}
