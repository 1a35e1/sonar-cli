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
      xid TEXT,
      text TEXT,
      created_at TEXT,
      like_count INTEGER,
      retweet_count INTEGER,
      reply_count INTEGER,
      quote_count INTEGER,
      view_count INTEGER,
      bookmark_count INTEGER
    );
    CREATE TABLE IF NOT EXISTS users (
      xid TEXT PRIMARY KEY,
      username TEXT,
      name TEXT,
      description TEXT,
      followers_count INTEGER,
      following_count INTEGER
    );
    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      tweet_id TEXT,
      similarity REAL,
      status TEXT,
      created_at TEXT,
      source TEXT DEFAULT 'network'
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      tweet_id TEXT PRIMARY KEY,
      indexed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS likes (
      tweet_id TEXT PRIMARY KEY,
      indexed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS tweet_embeddings (
      tweet_id TEXT PRIMARY KEY,
      embedding BLOB,
      model TEXT
    );
    CREATE TABLE IF NOT EXISTS topic_embeddings (
      topic_id TEXT PRIMARY KEY,
      name TEXT,
      embedding BLOB,
      model TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_cursors (
      model TEXT PRIMARY KEY,
      cursor TEXT
    );
  `)

  // Idempotent migration for existing DBs missing the suggestions.source column.
  const hasSource = (db.all('PRAGMA table_info(suggestions)') as { name: string }[])
    .some(col => col.name === 'source')
  if (!hasSource) {
    db.exec("ALTER TABLE suggestions ADD COLUMN source TEXT DEFAULT 'network'")
  }

  return db
}

/** Insert rows from a dataExport page into the matching local table. */
export function insertExportRows(db: Db, model: string, rows: Record<string, any>[]): number {
  if (rows.length === 0) return 0

  const inserters: Record<string, (row: Record<string, any>) => void> = {
    tweets: (r) => db.run(
      'INSERT OR REPLACE INTO tweets (id, xid, text, created_at, like_count, retweet_count, reply_count, quote_count, view_count, bookmark_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.xid, r.text, r.created_at, r.like_count, r.retweet_count, r.reply_count, r.quote_count, r.view_count, r.bookmark_count],
    ),
    users: (r) => db.run(
      'INSERT OR REPLACE INTO users (xid, username, name, description, followers_count, following_count) VALUES (?, ?, ?, ?, ?, ?)',
      [r.xid, r.username, r.name, r.description, r.followers_count, r.following_count],
    ),
    suggestions: (r) => db.run(
      'INSERT OR REPLACE INTO suggestions (id, tweet_id, similarity, status, created_at, source) VALUES (?, ?, ?, ?, ?, ?)',
      [r.id, r.tweet_id, r.similarity, r.status, r.created_at, r.source ?? 'network'],
    ),
    bookmarks: (r) => db.run(
      'INSERT OR REPLACE INTO bookmarks (tweet_id, indexed_at) VALUES (?, ?)',
      [r.tweet_id, r.indexed_at],
    ),
    likes: (r) => db.run(
      'INSERT OR REPLACE INTO likes (tweet_id, indexed_at) VALUES (?, ?)',
      [r.tweet_id, r.indexed_at],
    ),
    topics: (r) => db.run(
      'INSERT OR REPLACE INTO topics (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [r.id, r.name, r.description, r.created_at, r.updated_at],
    ),
    tweet_embeddings: (r) => db.run(
      'INSERT OR REPLACE INTO tweet_embeddings (tweet_id, embedding, model) VALUES (?, ?, ?)',
      [r.tweet_id, new Uint8Array(new Float32Array(r.embedding as number[]).buffer), r.model],
    ),
    topic_embeddings: (r) => db.run(
      'INSERT OR REPLACE INTO topic_embeddings (topic_id, name, embedding, model) VALUES (?, ?, ?, ?)',
      [r.topic_id, r.name, new Uint8Array(new Float32Array(r.embedding as number[]).buffer), r.model],
    ),
  }

  const insert = inserters[model]
  if (!insert) throw new Error(`Unknown model: ${model}`)

  db.exec('BEGIN')
  let count = 0
  for (const row of rows) {
    insert(row)
    count++
  }
  db.exec('COMMIT')
  return count
}

export function getSyncCursor(db: Db, model: string): string | null {
  const row = db.get('SELECT cursor FROM sync_cursors WHERE model = ?', [model]) as { cursor: string } | undefined
  return row?.cursor ?? null
}

export function setSyncCursor(db: Db, model: string, cursor: string): void {
  db.run('INSERT OR REPLACE INTO sync_cursors (model, cursor) VALUES (?, ?)', [model, cursor])
}

export function getRowCount(db: Db, table: string): number {
  const row = db.get(`SELECT COUNT(*) as n FROM ${table}`) as { n: number }
  return row.n
}

// Keep legacy helpers for other commands that still use them
export function upsertTweet(db: Db, tweet: {
  id: string; xid: string; text: string; createdAt: string
  likeCount: number; retweetCount: number; replyCount: number
  user: { username: string | null; displayName: string; followersCount: number | null; followingCount: number | null }
}): void {
  db.run(
    'INSERT OR REPLACE INTO tweets (id, xid, text, created_at, like_count, retweet_count, reply_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [tweet.id, tweet.xid, tweet.text, tweet.createdAt, tweet.likeCount, tweet.retweetCount, tweet.replyCount],
  )
}

export function upsertFeedItem(db: Db, item: { tweetId: string; score: number; matchedKeywords: string[] }): void {
  // Feed items go into suggestions table now
  db.run(
    'INSERT OR IGNORE INTO suggestions (id, tweet_id, similarity, status, created_at) VALUES (?, ?, ?, ?, ?)',
    [`feed_${item.tweetId}`, item.tweetId, item.score, 'feed', new Date().toISOString()],
  )
}

export function upsertSuggestion(db: Db, s: {
  suggestionId: string; tweetId: string; score: number; status: string
  relevance: string | null; projectsMatched: number
}): void {
  db.run(
    'INSERT OR REPLACE INTO suggestions (id, tweet_id, similarity, status, created_at) VALUES (?, ?, ?, ?, ?)',
    [s.suggestionId, s.tweetId, s.score, s.status, new Date().toISOString()],
  )
}

export function upsertTopic(db: Db, topic: {
  id: string; name: string; description: string | null
  createdAt: string; updatedAt: string
}): void {
  db.run(
    'INSERT OR REPLACE INTO topics (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [topic.id, topic.name, topic.description, topic.createdAt, topic.updatedAt],
  )
}

export function upsertBookmark(db: Db, tweetId: string): void {
  db.run('INSERT OR REPLACE INTO bookmarks (tweet_id, indexed_at) VALUES (?, ?)', [tweetId, new Date().toISOString()])
}

export function upsertLike(db: Db, tweetId: string): void {
  db.run('INSERT OR REPLACE INTO likes (tweet_id, indexed_at) VALUES (?, ?)', [tweetId, new Date().toISOString()])
}

export function hasEmbeddings(db: Db): boolean {
  const row = db.get('SELECT COUNT(*) as n FROM topic_embeddings') as { n: number }
  return row.n > 0
}

export function getSyncState(db: Db, key: string): string | null {
  return getSyncCursor(db, key)
}

export function setSyncState(db: Db, key: string, value: string): void {
  setSyncCursor(db, key, value)
}
