import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { unlinkSync, existsSync } from 'node:fs'
import { gql } from '../../lib/client.js'
import { Spinner } from '../../components/Spinner.js'
import { DB_PATH, openDb, insertExportRows, getRowCount } from '../../lib/db.js'
import { DATA_EXPORT_QUERY } from '../../lib/data-queries.js'
import type { DataExportPage } from '../../lib/data-queries.js'

type Props = {
  options: {
    debug: boolean
    fresh: boolean
  }
}

const MODELS = ['tweets', 'users', 'suggestions', 'bookmarks', 'likes', 'topics']
const PAID_MODELS = ['tweet_embeddings', 'topic_embeddings']

export default function DataPull({ options: flags }: Props) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [status, setStatus] = useState('Starting...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        if (flags.fresh && existsSync(DB_PATH)) unlinkSync(DB_PATH)

        const db = openDb()
        const result: Record<string, number> = {}

        for (const model of MODELS) {
          setStatus(`Pulling ${model}...`)
          let cursor: string | null = null
          let total = 0

          while (true) {
            const start = Date.now()
            const res: { dataExport: DataExportPage } = await gql(
              DATA_EXPORT_QUERY,
              { model, limit: 500, cursor },
            )
            const page = res.dataExport
            const elapsed = Date.now() - start

            if (flags.debug) {
              process.stderr.write(`  ${model} cursor=${cursor ?? 'null'} items=${page.items.length} ${elapsed}ms\n`)
            }

            const inserted = insertExportRows(db, model, page.items as Record<string, any>[])
            total += inserted

            if (!page.cursor) break
            cursor = page.cursor
          }

          result[model] = getRowCount(db, model === 'users' ? 'users' : model)
        }

        // Try embedding models — silently skip if plan doesn't support it
        for (const model of PAID_MODELS) {
          try {
            setStatus(`Pulling ${model}...`)
            let cursor: string | null = null
            let total = 0

            while (true) {
              const res: { dataExport: DataExportPage } = await gql(
                DATA_EXPORT_QUERY,
                { model, limit: 500, cursor },
              )
              const page = res.dataExport
              const inserted = insertExportRows(db, model, page.items as Record<string, any>[])
              total += inserted
              if (!page.cursor) break
              cursor = page.cursor
            }

            if (total > 0) result[model] = total
          } catch {
            // Plan doesn't support embeddings — skip silently
          }
        }

        db.close()
        setCounts(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!counts) return <Spinner label={status} />

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>Pull complete</Text>
        <Text dimColor>  {DB_PATH}</Text>
      </Box>
      <Box gap={2} flexWrap="wrap">
        {[...MODELS, ...PAID_MODELS].filter(m => counts[m] !== undefined).map(m => (
          <Text key={m}>
            <Text color="cyan">{counts[m]}</Text>
            <Text dimColor> {m}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  )
}
