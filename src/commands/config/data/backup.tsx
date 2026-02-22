import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Text } from 'ink'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { DB_PATH } from '../../../lib/db.js'

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

function integrityCheck(path: string): string {
  const db = new Database(path, { readonly: true })
  const rows = db.pragma('integrity_check') as Array<Record<string, string>>
  db.close()
  const first = Object.values(rows[0] ?? {})[0]
  return String(first ?? 'unknown')
}

export default function DataBackup({ options: flags }: Props) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (!existsSync(DB_PATH)) throw new Error(`source database not found: ${DB_PATH}`)

      const out = flags.out && flags.out.trim().length > 0
        ? flags.out
        : join(dirname(DB_PATH), `${basename(DB_PATH, '.db')}-backup-${ts()}.db`)

      mkdirSync(dirname(out), { recursive: true })

      // Best-effort WAL checkpoint before copy
      try {
        const db = new Database(DB_PATH)
        db.pragma('wal_checkpoint(TRUNCATE)')
        db.close()
      } catch {
        // non-fatal; continue with copy
      }

      copyFileSync(DB_PATH, out)
      if (existsSync(`${DB_PATH}-wal`)) copyFileSync(`${DB_PATH}-wal`, `${out}-wal`)
      if (existsSync(`${DB_PATH}-shm`)) copyFileSync(`${DB_PATH}-shm`, `${out}-shm`)

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
