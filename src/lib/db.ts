import pkg from 'node-sqlite3-wasm'
const { Database } = pkg
type Db = InstanceType<typeof Database>
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

export const DB_PATH = join(homedir(), '.sonar', 'data.db')

export function openDb(): Db {
  mkdirSync(dirname(DB_PATH), { recursive: true })
  const db = new Database(DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tweets (
      id TEXT PRIMARY KEY,
      xid TEXT, text TEXT, created_at TEXT,
      like_count INTEGER, retweet_count INTEGER, reply_count INTEGER,
      author_username TEXT, author_display_name TEXT,
      author_followers_count INTEGER, author_following_count INTEGER
    );
    CREATE TABLE IF NOT EXISTS feed_items (
      tweet_id TEXT PRIMARY KEY, score REAL,
      matched_keywords TEXT,
      synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS suggestions (
      suggestion_id TEXT PRIMARY KEY, tweet_id TEXT, score REAL,
      status TEXT, relevance TEXT,
      projects_matched TEXT,
      metadata TEXT,
      synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY, name TEXT, description TEXT,
      keywords TEXT, related_topics TEXT,
      created_at TEXT, updated_at TEXT, synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      tweet_id TEXT PRIMARY KEY,
      synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS likes (
      tweet_id TEXT PRIMARY KEY,
      synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY, value TEXT
    );
  `)
  return db
}

export function upsertTweet(db: Db, tweet: {
  id: string
  xid: string
  text: string
  createdAt: string
  likeCount: number
  retweetCount: number
  replyCount: number
  user: {
    username: string | null
    displayName: string
    followersCount: number | null
    followingCount: number | null
  }
}): void {
  db.run(`
    INSERT OR REPLACE INTO tweets
      (id, xid, text, created_at, like_count, retweet_count, reply_count,
       author_username, author_display_name, author_followers_count, author_following_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [tweet.id, tweet.xid, tweet.text, tweet.createdAt,
    tweet.likeCount, tweet.retweetCount, tweet.replyCount,
    tweet.user.username, tweet.user.displayName,
    tweet.user.followersCount, tweet.user.followingCount],
  )
}

export function upsertFeedItem(db: Db, item: {
  tweetId: string
  score: number
  matchedKeywords: string[]
}): void {
  db.run(`
    INSERT OR REPLACE INTO feed_items (tweet_id, score, matched_keywords, synced_at)
    VALUES (?, ?, ?, ?)
  `, [item.tweetId, item.score, JSON.stringify(item.matchedKeywords), new Date().toISOString()])
}

export function upsertSuggestion(db: Db, s: {
  suggestionId: string
  tweetId: string
  score: number
  status: string
  relevance: string | null
  projectsMatched: number
  metadata?: Record<string, unknown> | null
}): void {
  db.run(`
    INSERT OR REPLACE INTO suggestions
      (suggestion_id, tweet_id, score, status, relevance, projects_matched, metadata, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [s.suggestionId, s.tweetId, s.score, s.status, s.relevance,
    JSON.stringify(s.projectsMatched),
    s.metadata != null ? JSON.stringify(s.metadata) : null,
    new Date().toISOString()],
  )
}

export function upsertTopic(db: Db, topic: {
  id: string
  name: string
  description: string | null
  keywords?: string[] | null
  relatedTopics?: string[] | null
  createdAt: string
  updatedAt: string
}): void {
  db.run(`
    INSERT OR REPLACE INTO topics (id, name, description, keywords, related_topics, created_at, updated_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [topic.id, topic.name, topic.description,
    JSON.stringify(topic.keywords ?? []),
    JSON.stringify(topic.relatedTopics ?? []),
    topic.createdAt, topic.updatedAt,
    new Date().toISOString()],
  )
}

export function upsertBookmark(db: Db, tweetId: string): void {
  db.run('INSERT OR REPLACE INTO bookmarks (tweet_id, synced_at) VALUES (?, ?)', [tweetId, new Date().toISOString()])
}

export function upsertLike(db: Db, tweetId: string): void {
  db.run('INSERT OR REPLACE INTO likes (tweet_id, synced_at) VALUES (?, ?)', [tweetId, new Date().toISOString()])
}

export function getSyncState(db: Db, key: string): string | null {
  const row = db.get('SELECT value FROM sync_state WHERE key = ?', [key]) as { value: string } | undefined
  return row?.value ?? null
}

export function setSyncState(db: Db, key: string, value: string): void {
  db.run('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [key, value])
}
