import React, { useEffect, useState } from 'react'
import { Text } from 'ink'
import { openDb } from '../../lib/db.js'
import { parseWindow } from '../../lib/time.js'

type Props = {
  options: {
    window: string
    format: string
  }
}

function csvEscape(value: string | number | null): string {
  if (value == null) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const QUERY = `
  SELECT
    'https://x.com/' || u.username || '/status/' || t.id AS status_link,
    'https://x.com/' || u.username AS profile,
    u.username,
    u.name AS author,
    t.text AS content,
    t.like_count,
    t.retweet_count,
    t.reply_count,
    t.created_at,
    COALESCE(
      CASE WHEN b.tweet_id IS NOT NULL AND l.tweet_id IS NOT NULL AND s.id IS NOT NULL THEN 'bookmark,like,suggestion'
           WHEN b.tweet_id IS NOT NULL AND l.tweet_id IS NOT NULL THEN 'bookmark,like'
           WHEN b.tweet_id IS NOT NULL AND s.id IS NOT NULL THEN 'bookmark,suggestion'
           WHEN l.tweet_id IS NOT NULL AND s.id IS NOT NULL THEN 'like,suggestion'
           WHEN b.tweet_id IS NOT NULL THEN 'bookmark'
           WHEN l.tweet_id IS NOT NULL THEN 'like'
           WHEN s.id IS NOT NULL THEN 'suggestion'
      END,
      'feed'
    ) AS source,
    s.similarity,
    s.status AS suggestion_status,
    s.source AS suggestion_source
  FROM tweets t
  JOIN users u ON t.xid = u.xid
  LEFT JOIN bookmarks b ON b.tweet_id = t.id
  LEFT JOIN likes l ON l.tweet_id = t.id
  LEFT JOIN suggestions s ON s.tweet_id = t.id
  WHERE t.created_at >= datetime('now', ?)
  ORDER BY t.created_at DESC
`

const COLUMNS = [
  'status_link', 'profile', 'username', 'author',
  'like_count', 'retweet_count', 'reply_count', 'created_at',
  'source', 'similarity', 'suggestion_status', 'suggestion_source', 'content',
]

export default function DataExport({ options: flags }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    try {
      const modifier = parseWindow(flags.window)
      const db = openDb()
      const rows = db.all(QUERY, [modifier]) as Record<string, unknown>[]
      db.close()

      if (flags.format === 'json') {
        process.stdout.write(JSON.stringify(rows, null, 2) + '\n')
      } else {
        // CSV
        process.stdout.write(COLUMNS.join(',') + '\n')
        for (const row of rows) {
          const line = COLUMNS.map(c => csvEscape(row[c] as string | number | null)).join(',')
          process.stdout.write(line + '\n')
        }
      }

      process.stderr.write(`${rows.length} rows\n`)
      setDone(true)
      process.exit(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!done) return <Text dimColor>Exporting...</Text>
  return null
}
