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
  getSyncState,
  setSyncState,
} from '../../../lib/db.js'
import { FEED_QUERY, SUGGESTIONS_QUERY, INTERESTS_QUERY } from '../../../lib/data-queries.js'
import type { FeedTweet, Suggestion, Interest } from '../../../lib/data-queries.js'

interface SyncResult {
  feedCount: number
  suggestionsCount: number
  interestsCount: number
  isSync?: boolean
  deltaFeed?: number
  deltaSuggestions?: number
}

export default function DataSync() {
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        const db = openDb()
        const lastSyncedAt = getSyncState(db, 'last_synced_at')

        if (!lastSyncedAt) {
          db.close()
          if (existsSync(DB_PATH)) unlinkSync(DB_PATH)
          const freshDb = openDb()
          const [feedResult, suggestionsResult, interestsResult] = await Promise.all([
            gql<{ feed: FeedTweet[] }>(FEED_QUERY, { hours: null, days: 7, limit: 500 }),
            gql<{ suggestions: Suggestion[] }>(SUGGESTIONS_QUERY, { status: null, limit: 500 }),
            gql<{ projects: Interest[] }>(INTERESTS_QUERY),
          ])

          for (const item of feedResult.feed) {
            upsertTweet(freshDb, item.tweet)
            upsertFeedItem(freshDb, { tweetId: item.tweet.id, score: item.score, matchedKeywords: item.matchedKeywords })
          }
          for (const s of suggestionsResult.suggestions) {
            upsertTweet(freshDb, s.tweet)
            upsertSuggestion(freshDb, { suggestionId: s.suggestionId, tweetId: s.tweet.id, score: s.score, status: s.status, relevance: null, projectsMatched: s.projectsMatched })
          }
          for (const i of interestsResult.projects) {
            upsertInterest(freshDb, i)
          }

          setSyncState(freshDb, 'last_synced_at', new Date().toISOString())
          freshDb.close()

          setResult({ feedCount: feedResult.feed.length, suggestionsCount: suggestionsResult.suggestions.length, interestsCount: interestsResult.projects.length })
          return
        }

        const hoursSinceSync = Math.min(
          Math.ceil((Date.now() - new Date(lastSyncedAt).getTime()) / 3600000),
          168,
        )

        const [feedResult, suggestionsResult] = await Promise.all([
          gql<{ feed: FeedTweet[] }>(FEED_QUERY, { hours: hoursSinceSync, days: null, limit: 500 }),
          gql<{ suggestions: Suggestion[] }>(SUGGESTIONS_QUERY, { status: null, limit: 500 }),
        ])

        const prevFeedCount = (db.prepare('SELECT COUNT(*) as n FROM feed_items').get() as { n: number }).n
        const prevSuggestionsCount = (db.prepare('SELECT COUNT(*) as n FROM suggestions').get() as { n: number }).n

        for (const item of feedResult.feed) {
          upsertTweet(db, item.tweet)
          upsertFeedItem(db, { tweetId: item.tweet.id, score: item.score, matchedKeywords: item.matchedKeywords })
        }
        for (const s of suggestionsResult.suggestions) {
          upsertTweet(db, s.tweet)
          upsertSuggestion(db, { suggestionId: s.suggestionId, tweetId: s.tweet.id, score: s.score, status: s.status, relevance: null, projectsMatched: s.projectsMatched })
        }

        setSyncState(db, 'last_synced_at', new Date().toISOString())

        const newFeedCount = (db.prepare('SELECT COUNT(*) as n FROM feed_items').get() as { n: number }).n
        const newSuggestionsCount = (db.prepare('SELECT COUNT(*) as n FROM suggestions').get() as { n: number }).n
        db.close()

        setResult({
          feedCount: newFeedCount,
          suggestionsCount: newSuggestionsCount,
          interestsCount: 0,
          isSync: true,
          deltaFeed: newFeedCount - prevFeedCount,
          deltaSuggestions: newSuggestionsCount - prevSuggestionsCount,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!result) return <Spinner label="Syncing data..." />

  if (result.isSync) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>Sync complete</Text>
          <Text dimColor>  {DB_PATH}</Text>
        </Box>
        <Text>
          <Text color="green">feed</Text>
          <Text dimColor> +{result.deltaFeed ?? 0} ({result.feedCount} total)  </Text>
          <Text color="green">suggestions</Text>
          <Text dimColor> +{result.deltaSuggestions ?? 0} ({result.suggestionsCount} total)</Text>
        </Text>
      </Box>
    )
  }

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
