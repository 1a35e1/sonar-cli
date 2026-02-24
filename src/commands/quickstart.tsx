import React, { useEffect, useRef, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { gql } from '../lib/client.js'
import { readConfig } from '../lib/config.js'
import { Spinner } from '../components/Spinner.js'
import type { Account } from '../components/AccountCard.js'
import type { Interest } from './interests/index.js'
import type { Suggestion } from './inbox/index.js'

// ─── Queries / Mutations ──────────────────────────────────────────────────────

const BOOTSTRAP_QUERY = `
  query QuickstartBootstrap {
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

const CREATE_MUTATION = `
  mutation CreateOrUpdateInterest(
    $nanoId: String
    $name: String!
    $description: String
    $keywords: [String!]
    $relatedTopics: [String!]
  ) {
    createOrUpdateProject(input: {
      nanoId: $nanoId
      name: $name
      description: $description
      keywords: $keywords
      relatedTopics: $relatedTopics
    }) {
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

const INGEST_MUTATION = `
  mutation IndexTweets {
    indexTweets
  }
`

const INBOX_QUERY = `
  query QuickstartInbox($status: SuggestionStatus, $limit: Int) {
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface InterestDraft {
  name: string
  description: string
  keywords: string[]
  relatedTopics: string[]
}

type Phase =
  | { type: 'loading' }
  | { type: 'unauthenticated' }
  | { type: 'error'; message: string }
  | { type: 'confirm'; me: Account; suggestions: InterestDraft[] }
  | { type: 'creating'; suggestions: InterestDraft[]; progress: number }
  | { type: 'ingesting' }
  | { type: 'inbox'; items: Suggestion[]; created: boolean }
  | { type: 'inbox-empty' }

// ─── Starter interest suggestions ────────────────────────────────────────────

/**
 * Returns 3 sensible starter interest drafts. In the future this could use
 * the user's X bio / pinned tweet, but for now these are broadly useful
 * defaults for the typical Sonar user (tech-forward Twitter crowd).
 */
function buildStarterSuggestions(_xHandle: string): InterestDraft[] {
  return [
    {
      name: 'AI and machine learning',
      description: 'Breakthroughs, papers, tools, and discussion around AI, LLMs, and machine learning.',
      keywords: ['LLM', 'AI agents', 'machine learning', 'GPT', 'fine-tuning', 'inference'],
      relatedTopics: ['artificial intelligence', 'deep learning', 'foundation models'],
    },
    {
      name: 'Software engineering and developer tools',
      description: 'New frameworks, libraries, OSS releases, and engineering practices worth tracking.',
      keywords: ['open source', 'TypeScript', 'Rust', 'developer tools', 'CLI', 'API design'],
      relatedTopics: ['software development', 'devex', 'programming'],
    },
    {
      name: 'Tech startups and product launches',
      description: 'Funding rounds, product launches, founder insights, and market moves in tech.',
      keywords: ['startup', 'YC', 'product launch', 'founder', 'seed round', 'SaaS'],
      relatedTopics: ['venture capital', 'entrepreneurship', 'B2B software'],
    },
  ]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function hasToken(): boolean {
  if (process.env.SONAR_API_KEY) return true
  const config = readConfig()
  return Boolean(config.token)
}

// ─── Sub-renders ──────────────────────────────────────────────────────────────

function UnauthenticatedView() {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="yellow">⚠  Not authenticated</Text>
      <Text>
        Sonar needs an API key to get started. Get one at{' '}
        <Text color="cyan">https://sonar.8640p.info</Text>
      </Text>
      <Box flexDirection="column" gap={0}>
        <Text dimColor>Then run one of:</Text>
        <Text>  <Text color="cyan">SONAR_API_KEY=&lt;key&gt; sonar quickstart</Text>  (one-off)</Text>
        <Text>  <Text color="cyan">sonar config setup --key &lt;key&gt;</Text>          (persist to ~/.sonar/config.json)</Text>
      </Box>
    </Box>
  )
}

function ConfirmView({
  me,
  suggestions,
  onConfirm,
  onAbort,
}: {
  me: Account
  suggestions: InterestDraft[]
  onConfirm: () => void
  onAbort: () => void
}) {
  useInput((input, key) => {
    if (key.return || input === 'y' || input === 'Y') {
      onConfirm()
    } else if (input === 'n' || input === 'N' || key.escape) {
      onAbort()
    }
  })

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text bold color="cyan">Welcome to Sonar,</Text>
        <Text bold>@{me.xHandle}!</Text>
      </Box>

      <Text>
        You have no interests set up yet. Here are 3 starter suggestions to get
        your inbox going:
      </Text>

      {suggestions.map((s, i) => (
        <Box key={s.name} flexDirection="column" gap={0} paddingLeft={2}>
          <Box gap={1}>
            <Text color="cyan">{i + 1}.</Text>
            <Text bold>{s.name}</Text>
          </Box>
          <Box paddingLeft={4}><Text dimColor>{s.description}</Text></Box>
          <Box gap={1} paddingLeft={4}>
            <Text dimColor>keywords:</Text>
            <Text dimColor>{s.keywords.slice(0, 4).join(', ')}</Text>
          </Box>
        </Box>
      ))}

      <Box marginTop={1} gap={1}>
        <Text dimColor>Create these interests and kick off indexing?</Text>
        <Text bold color="cyan">[Y/n]</Text>
      </Box>
      <Text dimColor>
        tip: customise later with{' '}
        <Text color="cyan">sonar interests create --from-prompt "..."</Text>
      </Text>
    </Box>
  )
}

function CreatingView({ suggestions, progress }: { suggestions: InterestDraft[]; progress: number }) {
  return (
    <Box flexDirection="column" gap={0}>
      <Box gap={1} marginBottom={1}>
        <Text bold>Setting up interests</Text>
        <Text dimColor>({progress}/{suggestions.length})</Text>
      </Box>
      {suggestions.map((s, i) => (
        <Box key={s.name} gap={1}>
          {i < progress ? (
            <Text color="green">✓</Text>
          ) : i === progress ? (
            <Spinner label="" />
          ) : (
            <Text dimColor>·</Text>
          )}
          <Text dimColor={i > progress} color={i < progress ? 'green' : undefined}>
            {s.name}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

function InboxView({ items, created }: { items: Suggestion[]; created: boolean }) {
  if (items.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        {created ? (
          <Text color="green">✓ Interests created and indexing triggered!</Text>
        ) : (
          <Text color="green">✓ Your interests are set up — indexing is in progress.</Text>
        )}
        <Box flexDirection="column" gap={0}>
          <Text>Your inbox is empty right now — indexing takes a few minutes.</Text>
          <Text dimColor>Check back shortly with: <Text color="cyan">sonar inbox</Text></Text>
        </Box>
        <Box flexDirection="column" gap={0}>
          <Text dimColor>Monitor indexing progress: <Text color="cyan">sonar monitor</Text></Text>
          <Text dimColor>Browse your full inbox: <Text color="cyan">sonar inbox</Text></Text>
          <Text dimColor>Edit interests: <Text color="cyan">sonar interests</Text></Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="green">✓ You're all set! Here's your inbox:</Text>

      {items.slice(0, 10).map((s) => {
        const handle = s.tweet.user.username ?? s.tweet.user.displayName
        return (
          <Box key={s.suggestionId} flexDirection="column" gap={0}>
            <Box gap={2}>
              <Text color="cyan">{relativeTime(s.tweet.createdAt)}</Text>
              <Text color="green">{s.score.toFixed(2)}</Text>
              <Text dimColor>@{handle}</Text>
            </Box>
            <Box paddingLeft={2} width={80}>
              <Text wrap="wrap" dimColor>{s.tweet.text.replace(/\n/g, ' ').slice(0, 120)}</Text>
            </Box>
          </Box>
        )
      })}

      {items.length > 10 && (
        <Text dimColor>… and {items.length - 10} more. Run <Text color="cyan">sonar inbox</Text> to see all.</Text>
      )}

      <Text dimColor>
        Interactive mode: <Text color="cyan">sonar inbox --interactive</Text>
        {'  ·  '}
        Full inbox: <Text color="cyan">sonar inbox</Text>
      </Text>
    </Box>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Quickstart() {
  const { exit } = useApp()
  const [phase, setPhase] = useState<Phase>({ type: 'loading' })
  const abortedRef = useRef(false)

  // ── Bootstrap: check auth + fetch me + projects ──────────────────────────
  useEffect(() => {
    if (!hasToken()) {
      setPhase({ type: 'unauthenticated' })
      return
    }

    async function bootstrap() {
      try {
        const result = await gql<{ me: Account | null; projects: Interest[] }>(BOOTSTRAP_QUERY)

        if (!result.me) {
          setPhase({ type: 'unauthenticated' })
          return
        }

        // If interests already exist, jump straight to inbox
        if (result.projects.length > 0) {
          const inbox = await gql<{ suggestions: Suggestion[] }>(INBOX_QUERY, {
            status: 'INBOX',
            limit: 20,
          })
          setPhase({ type: 'inbox', items: inbox.suggestions, created: false })
          return
        }

        // No interests — propose starters
        const suggestions = buildStarterSuggestions(result.me.xHandle)
        setPhase({ type: 'confirm', me: result.me, suggestions })
      } catch (err) {
        setPhase({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    }

    bootstrap()
  }, [])

  // ── Create interests + ingest (triggered from confirm handler) ────────────
  const handleConfirm = async (suggestions: InterestDraft[]) => {
    setPhase({ type: 'creating', suggestions, progress: 0 })

    try {
      // Create each interest sequentially so progress counter is accurate
      for (let i = 0; i < suggestions.length; i++) {
        if (abortedRef.current) return
        const s = suggestions[i]
        await gql(CREATE_MUTATION, {
          nanoId: null,
          name: s.name,
          description: s.description,
          keywords: s.keywords,
          relatedTopics: s.relatedTopics,
        })
        setPhase({ type: 'creating', suggestions, progress: i + 1 })
      }

      // Trigger ingest
      setPhase({ type: 'ingesting' })
      await gql<{ indexTweets: boolean }>(INGEST_MUTATION)

      // Fetch initial inbox (may be empty — that's fine)
      const inbox = await gql<{ suggestions: Suggestion[] }>(INBOX_QUERY, {
        status: 'INBOX',
        limit: 20,
      })
      setPhase(
        inbox.suggestions.length === 0
          ? { type: 'inbox-empty' }
          : { type: 'inbox', items: inbox.suggestions, created: true }
      )
    } catch (err) {
      setPhase({ type: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const handleAbort = () => {
    abortedRef.current = true
    process.stdout.write('\nAborted. Run sonar quickstart again whenever you\'re ready.\n')
    exit()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  switch (phase.type) {
    case 'loading':
      return <Spinner label="Loading your Sonar profile..." />

    case 'unauthenticated':
      return <UnauthenticatedView />

    case 'error':
      return (
        <Box flexDirection="column" gap={1}>
          <Text color="red">Error: {phase.message}</Text>
          <Text dimColor>Check your connection and API key, then retry: <Text color="cyan">sonar quickstart</Text></Text>
        </Box>
      )

    case 'confirm':
      return (
        <ConfirmView
          me={phase.me}
          suggestions={phase.suggestions}
          onConfirm={() => handleConfirm(phase.suggestions)}
          onAbort={handleAbort}
        />
      )

    case 'creating':
      return <CreatingView suggestions={phase.suggestions} progress={phase.progress} />

    case 'ingesting':
      return <Spinner label="Triggering tweet indexing..." />

    case 'inbox':
      return <InboxView items={phase.items} created={phase.created} />

    case 'inbox-empty':
      return <InboxView items={[]} created={true} />
  }
}
