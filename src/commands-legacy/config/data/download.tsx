import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { unlinkSync, existsSync } from 'node:fs'
import { gql } from '../../../lib/client.js'
import { Spinner } from '../../../components/Spinner.js'
import {
  DB_PATH,
  openDb,
  upsertTweet,
  upsertFeedItem,
  upsertSuggestion,
  upsertInterest,
  setSyncState,
} from '../../../lib/db.js'
import { FEED_QUERY, SUGGESTIONS_QUERY, INTERESTS_QUERY } from '../../../lib/data-queries.js'
import type { FeedTweet, Suggestion, Interest } from '../../../lib/data-queries.js'

export default function DataDownload() {
  const [result, setResult] = useState<{ feedCount: number; suggestionsCount: number; interestsCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        if (existsSync(DB_PATH)) unlinkSync(DB_PATH)

        const db = openDb()
        const [feedResult, suggestionsResult, interestsResult] = await Promise.all([
          gql<{ feed: FeedTweet[] }>(FEED_QUERY, { hours: null, days: 7, limit: 500 }),
          gql<{ suggestions: Suggestion[] }>(SUGGESTIONS_QUERY, { status: null, limit: 500 }),
          gql<{ projects: Interest[] }>(INTERESTS_QUERY),
        ])

        for (const item of feedResult.feed) {
          upsertTweet(db, item.tweet)
          upsertFeedItem(db, { tweetId: item.tweet.id, score: item.score, matchedKeywords: item.matchedKeywords })
        }
        for (const s of suggestionsResult.suggestions) {
          upsertTweet(db, s.tweet)
          upsertSuggestion(db, { suggestionId: s.suggestionId, tweetId: s.tweet.id, score: s.score, status: s.status, relevance: null, projectsMatched: s.projectsMatched })
        }
        for (const i of interestsResult.projects) {
          upsertInterest(db, i)
        }

        setSyncState(db, 'last_synced_at', new Date().toISOString())
        db.close()

        setResult({
          feedCount: feedResult.feed.length,
          suggestionsCount: suggestionsResult.suggestions.length,
          interestsCount: interestsResult.projects.length,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!result) return <Spinner label="Downloading data..." />

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>Download complete</Text>
        <Text dimColor>  {DB_PATH}</Text>
      </Box>
      <Text>
        <Text color="cyan">{result.feedCount}</Text>
        <Text dimColor> feed items  </Text>
        <Text color="cyan">{result.suggestionsCount}</Text>
        <Text dimColor> suggestions  </Text>
        <Text color="cyan">{result.interestsCount}</Text>
        <Text dimColor> interests</Text>
      </Text>
    </Box>
  )
}
