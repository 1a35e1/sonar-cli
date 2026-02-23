import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Text } from 'ink'
import { existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { DB_PATH } from '../../../lib/db.js'
import { integrityCheck } from './utils.js'

export const options = zod.object({
  out: zod.string().optional().describe('Backup output path (default: ~/.sonar/data-backup-<timestamp>.db)'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
})

type Props = { options: zod.infer<typeof options> }

function ts(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}

export default function DataBackup({ options: flags }: Props) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        if (!existsSync(DB_PATH)) throw new Error(`source database not found: ${DB_PATH}`)

        // Use trimmed value for the actual output path to avoid confusing
        // filesystem errors from leading/trailing whitespace.
        const trimmedOut = flags.out?.trim()
        const out = trimmedOut && trimmedOut.length > 0
          ? trimmedOut
          : join(dirname(DB_PATH), `${basename(DB_PATH, '.db')}-backup-${ts()}.db`)

        mkdirSync(dirname(out), { recursive: true })

        // Use SQLite's online backup API (better-sqlite3 wraps the C-level
        // sqlite3_backup_* functions) instead of a plain filesystem copy.
        // This works correctly under concurrent writes: it iterates over DB
        // pages in a consistent snapshot without requiring an exclusive lock
        // and without needing a prior WAL checkpoint.
        const db = new Database(DB_PATH)
        try {
          await db.backup(out)
        } finally {
          db.close()
        }

        const check = integrityCheck(out)
        if (check !== 'ok') throw new Error(`backup integrity check failed: ${check}`)

        const result = { ok: true, source: DB_PATH, backup: out }
        if (flags.json) {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
        } else {
          process.stdout.write(`Backup complete: ${out}\n`)
        }
        process.exit(0)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    run()
  }, [])

  useEffect(() => {
    if (!error) return
    if (flags.json) {
      process.stderr.write(`${error}\n`)
      process.exit(1)
    }
  }, [error, flags.json])

  if (error) return flags.json ? <></> : <Text color="red">Error: {error}</Text>
  return flags.json ? <></> : <Text dimColor>Creating backup...</Text>
}
