import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { unlinkSync, existsSync } from 'node:fs'
import { gql } from '../../lib/client.js'
import { Spinner } from '../../components/Spinner.js'
import {
  DB_PATH,
  openDb,
  upsertTweet,
  upsertFeedItem,
  upsertSuggestion,
  upsertTopic,
  upsertBookmark,
  upsertLike,
  getSyncState,
  setSyncState,
} from '../../lib/db.js'
import { FEED_QUERY, SUGGESTIONS_QUERY, INTERESTS_QUERY, BOOKMARKS_QUERY, LIKES_QUERY } from '../../lib/data-queries.js'
import type { FeedTweet, Suggestion, Interest, Tweet } from '../../lib/data-queries.js'

interface PullResult {
  feedCount: number
  suggestionsCount: number
  topicsCount: number
  bookmarksCount: number
  likesCount: number
  isIncremental?: boolean
  deltaFeed?: number
  deltaSuggestions?: number
}

export default function DataPull() {
  const [result, setResult] = useState<PullResult | null>(null)
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
          const [feedRes, suggestionsRes, topicsRes, bookmarksRes, likesRes] = await Promise.all([
            gql<{ feed: FeedTweet[] }>(FEED_QUERY, { hours: null, days: 7, limit: 500 }),
            gql<{ suggestions: Suggestion[] }>(SUGGESTIONS_QUERY, { status: null, limit: 500 }),
            gql<{ topics: Interest[] }>(INTERESTS_QUERY),
            gql<{ bookmarks: Tweet[] }>(BOOKMARKS_QUERY, { limit: 500, offset: 0 }),
            gql<{ likes: Tweet[] }>(LIKES_QUERY, { limit: 500, offset: 0 }),
          ])

          for (const item of feedRes.feed) {
            upsertTweet(freshDb, item.tweet)
            upsertFeedItem(freshDb, { tweetId: item.tweet.id, score: item.score, matchedKeywords: item.matchedKeywords })
          }
          for (const s of suggestionsRes.suggestions) {
            upsertTweet(freshDb, s.tweet)
            upsertSuggestion(freshDb, { suggestionId: s.suggestionId, tweetId: s.tweet.id, score: s.score, status: s.status, relevance: null, projectsMatched: s.projectsMatched })
          }
          for (const t of topicsRes.topics) {
            upsertTopic(freshDb, t)
          }
          for (const bm of bookmarksRes.bookmarks) {
            upsertTweet(freshDb, bm)
            upsertBookmark(freshDb, bm.id)
          }
          for (const lk of likesRes.likes) {
            upsertTweet(freshDb, lk)
            upsertLike(freshDb, lk.id)
          }

          setSyncState(freshDb, 'last_synced_at', new Date().toISOString())
          freshDb.close()

          setResult({
            feedCount: feedRes.feed.length,
            suggestionsCount: suggestionsRes.suggestions.length,
            topicsCount: topicsRes.topics.length,
            bookmarksCount: bookmarksRes.bookmarks.length,
            likesCount: likesRes.likes.length,
          })
          return
        }

        const hoursSinceSync = Math.min(
          Math.ceil((Date.now() - new Date(lastSyncedAt).getTime()) / 3600000),
          168,
        )

        const [feedRes, suggestionsRes, bookmarksRes, likesRes] = await Promise.all([
          gql<{ feed: FeedTweet[] }>(FEED_QUERY, { hours: hoursSinceSync, days: null, limit: 500 }),
          gql<{ suggestions: Suggestion[] }>(SUGGESTIONS_QUERY, { status: null, limit: 500 }),
          gql<{ bookmarks: Tweet[] }>(BOOKMARKS_QUERY, { limit: 500, offset: 0 }),
          gql<{ likes: Tweet[] }>(LIKES_QUERY, { limit: 500, offset: 0 }),
        ])

        const prevFeedCount = (db.get('SELECT COUNT(*) as n FROM feed_items') as { n: number }).n
        const prevSuggestionsCount = (db.get('SELECT COUNT(*) as n FROM suggestions') as { n: number }).n

        for (const item of feedRes.feed) {
          upsertTweet(db, item.tweet)
          upsertFeedItem(db, { tweetId: item.tweet.id, score: item.score, matchedKeywords: item.matchedKeywords })
        }
        for (const s of suggestionsRes.suggestions) {
          upsertTweet(db, s.tweet)
          upsertSuggestion(db, { suggestionId: s.suggestionId, tweetId: s.tweet.id, score: s.score, status: s.status, relevance: null, projectsMatched: s.projectsMatched })
        }
        for (const bm of bookmarksRes.bookmarks) {
          upsertTweet(db, bm)
          upsertBookmark(db, bm.id)
        }
        for (const lk of likesRes.likes) {
          upsertTweet(db, lk)
          upsertLike(db, lk.id)
        }

        setSyncState(db, 'last_synced_at', new Date().toISOString())

        const newFeedCount = (db.get('SELECT COUNT(*) as n FROM feed_items') as { n: number }).n
        const newSuggestionsCount = (db.get('SELECT COUNT(*) as n FROM suggestions') as { n: number }).n
        const bookmarksCount = (db.get('SELECT COUNT(*) as n FROM bookmarks') as { n: number }).n
        const likesCount = (db.get('SELECT COUNT(*) as n FROM likes') as { n: number }).n
        db.close()

        setResult({
          feedCount: newFeedCount,
          suggestionsCount: newSuggestionsCount,
          topicsCount: 0,
          bookmarksCount,
          likesCount,
          isIncremental: true,
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
  if (!result) return <Spinner label="Pulling data..." />

  if (result.isIncremental) {
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
          <Text dimColor> +{result.deltaSuggestions ?? 0} ({result.suggestionsCount} total)  </Text>
          <Text color="green">bookmarks</Text>
          <Text dimColor> {result.bookmarksCount}  </Text>
          <Text color="green">likes</Text>
          <Text dimColor> {result.likesCount}</Text>
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
        <Text dimColor> feed  </Text>
        <Text color="cyan">{result.suggestionsCount}</Text>
        <Text dimColor> suggestions  </Text>
        <Text color="cyan">{result.topicsCount}</Text>
        <Text dimColor> topics  </Text>
        <Text color="cyan">{result.bookmarksCount}</Text>
        <Text dimColor> bookmarks  </Text>
        <Text color="cyan">{result.likesCount}</Text>
        <Text dimColor> likes</Text>
      </Text>
    </Box>
  )
}
