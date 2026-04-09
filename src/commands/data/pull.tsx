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

const PAGE_SIZE = 100

/** Paginate a query that returns an array, fetching all pages. */
async function fetchAll<T>(
  query: string,
  field: string,
  baseVars: Record<string, unknown>,
): Promise<T[]> {
  const all: T[] = []
  let offset = 0
  while (true) {
    const res = await gql<Record<string, T[]>>(query, { ...baseVars, limit: PAGE_SIZE, offset })
    const page = res[field] ?? []
    all.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return all
}

interface PullResult {
  feedCount: number
  suggestionsCount: number
  topicsCount: number
  bookmarksCount: number
  likesCount: number
  isIncremental?: boolean
  deltaFeed?: number
  deltaSuggestions?: number
  deltaBookmarks?: number
  deltaLikes?: number
}

export default function DataPull() {
  const [result, setResult] = useState<PullResult | null>(null)
  const [status, setStatus] = useState('Starting...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        const db = openDb()
        const lastSyncedAt = getSyncState(db, 'last_synced_at')

        if (!lastSyncedAt) {
          // Fresh download
          db.close()
          if (existsSync(DB_PATH)) unlinkSync(DB_PATH)
          const freshDb = openDb()

          setStatus('Pulling feed...')
          const feed = await fetchAll<FeedTweet>(FEED_QUERY, 'feed', { hours: null, days: 7 })
          for (const item of feed) {
            upsertTweet(freshDb, item.tweet)
            upsertFeedItem(freshDb, { tweetId: item.tweet.id, score: item.score, matchedKeywords: item.matchedKeywords })
          }

          setStatus('Pulling suggestions...')
          const suggestions = await fetchAll<Suggestion>(SUGGESTIONS_QUERY, 'suggestions', { status: null })
          for (const s of suggestions) {
            upsertTweet(freshDb, s.tweet)
            upsertSuggestion(freshDb, { suggestionId: s.suggestionId, tweetId: s.tweet.id, score: s.score, status: s.status, relevance: null, projectsMatched: s.projectsMatched })
          }

          setStatus('Pulling topics...')
          const { topics } = await gql<{ topics: Interest[] }>(INTERESTS_QUERY)
          for (const t of topics) upsertTopic(freshDb, t)

          setStatus('Pulling bookmarks...')
          const bookmarks = await fetchAll<Tweet>(BOOKMARKS_QUERY, 'bookmarks', { since: null })
          for (const bm of bookmarks) {
            upsertTweet(freshDb, bm)
            upsertBookmark(freshDb, bm.id)
          }

          setStatus('Pulling likes...')
          const likes = await fetchAll<Tweet>(LIKES_QUERY, 'likes', { since: null })
          for (const lk of likes) {
            upsertTweet(freshDb, lk)
            upsertLike(freshDb, lk.id)
          }

          setSyncState(freshDb, 'last_synced_at', new Date().toISOString())
          freshDb.close()

          setResult({
            feedCount: feed.length,
            suggestionsCount: suggestions.length,
            topicsCount: topics.length,
            bookmarksCount: bookmarks.length,
            likesCount: likes.length,
          })
          return
        }

        // Incremental sync
        const hoursSinceSync = Math.min(
          Math.ceil((Date.now() - new Date(lastSyncedAt).getTime()) / 3600000),
          168,
        )

        const prevFeedCount = (db.get('SELECT COUNT(*) as n FROM feed_items') as { n: number }).n
        const prevSuggestionsCount = (db.get('SELECT COUNT(*) as n FROM suggestions') as { n: number }).n
        const prevBookmarksCount = (db.get('SELECT COUNT(*) as n FROM bookmarks') as { n: number }).n
        const prevLikesCount = (db.get('SELECT COUNT(*) as n FROM likes') as { n: number }).n

        setStatus('Pulling feed...')
        const feed = await fetchAll<FeedTweet>(FEED_QUERY, 'feed', { hours: hoursSinceSync, days: null })
        for (const item of feed) {
          upsertTweet(db, item.tweet)
          upsertFeedItem(db, { tweetId: item.tweet.id, score: item.score, matchedKeywords: item.matchedKeywords })
        }

        setStatus('Pulling suggestions...')
        const suggestions = await fetchAll<Suggestion>(SUGGESTIONS_QUERY, 'suggestions', { status: null })
        for (const s of suggestions) {
          upsertTweet(db, s.tweet)
          upsertSuggestion(db, { suggestionId: s.suggestionId, tweetId: s.tweet.id, score: s.score, status: s.status, relevance: null, projectsMatched: s.projectsMatched })
        }

        setStatus('Pulling bookmarks...')
        const bookmarks = await fetchAll<Tweet>(BOOKMARKS_QUERY, 'bookmarks', { since: lastSyncedAt })
        for (const bm of bookmarks) {
          upsertTweet(db, bm)
          upsertBookmark(db, bm.id)
        }

        setStatus('Pulling likes...')
        const likes = await fetchAll<Tweet>(LIKES_QUERY, 'likes', { since: lastSyncedAt })
        for (const lk of likes) {
          upsertTweet(db, lk)
          upsertLike(db, lk.id)
        }

        setSyncState(db, 'last_synced_at', new Date().toISOString())

        const newFeedCount = (db.get('SELECT COUNT(*) as n FROM feed_items') as { n: number }).n
        const newSuggestionsCount = (db.get('SELECT COUNT(*) as n FROM suggestions') as { n: number }).n
        const newBookmarksCount = (db.get('SELECT COUNT(*) as n FROM bookmarks') as { n: number }).n
        const newLikesCount = (db.get('SELECT COUNT(*) as n FROM likes') as { n: number }).n
        db.close()

        setResult({
          feedCount: newFeedCount,
          suggestionsCount: newSuggestionsCount,
          topicsCount: 0,
          bookmarksCount: newBookmarksCount,
          likesCount: newLikesCount,
          isIncremental: true,
          deltaFeed: newFeedCount - prevFeedCount,
          deltaSuggestions: newSuggestionsCount - prevSuggestionsCount,
          deltaBookmarks: newBookmarksCount - prevBookmarksCount,
          deltaLikes: newLikesCount - prevLikesCount,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!result) return <Spinner label={status} />

  if (result.isIncremental) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>Sync complete</Text>
          <Text dimColor>  {DB_PATH}</Text>
        </Box>
        <Text>
          <Text color="green">feed</Text>
          <Text dimColor> +{result.deltaFeed ?? 0} ({result.feedCount})  </Text>
          <Text color="green">suggestions</Text>
          <Text dimColor> +{result.deltaSuggestions ?? 0} ({result.suggestionsCount})  </Text>
          <Text color="green">bookmarks</Text>
          <Text dimColor> +{result.deltaBookmarks ?? 0} ({result.bookmarksCount})  </Text>
          <Text color="green">likes</Text>
          <Text dimColor> +{result.deltaLikes ?? 0} ({result.likesCount})</Text>
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
