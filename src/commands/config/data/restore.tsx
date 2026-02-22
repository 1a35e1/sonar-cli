import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Text } from 'ink'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { DB_PATH } from '../../../lib/db.js'

export const options = zod.object({
  from: zod.string().describe('Backup database path to restore from'),
  to: zod.string().optional().describe('Target database path (default: local sonar DB path)'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
})

type Props = { options: zod.infer<typeof options> }

function integrityCheck(path: string): string {
  const db = new Database(path, { readonly: true })
  const rows = db.pragma('integrity_check') as Array<Record<string, string>>
  db.close()
  const first = Object.values(rows[0] ?? {})[0]
  return String(first ?? 'unknown')
}

export default function DataRestore({ options: flags }: Props) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const src = flags.from
      const dst = flags.to ?? DB_PATH
      if (!existsSync(src)) throw new Error(`backup not found: ${src}`)
      const srcCheck = integrityCheck(src)
      if (srcCheck !== 'ok') throw new Error(`backup integrity check failed: ${srcCheck}`)

      mkdirSync(dirname(dst), { recursive: true })

      const preRestore = existsSync(dst) ? `${dst}.pre-restore.${Date.now()}` : null
      if (preRestore) copyFileSync(dst, preRestore)

      copyFileSync(src, dst)

      if (existsSync(`${src}-wal`)) copyFileSync(`${src}-wal`, `${dst}-wal`)
      else rmSync(`${dst}-wal`, { force: true })
      if (existsSync(`${src}-shm`)) copyFileSync(`${src}-shm`, `${dst}-shm`)
      else rmSync(`${dst}-shm`, { force: true })

      const dstCheck = integrityCheck(dst)
      if (dstCheck !== 'ok') throw new Error(`restored database integrity check failed: ${dstCheck}`)

      const result = { ok: true, from: src, to: dst, preRestore }
      if (flags.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      else process.stdout.write(`Restore complete: ${src} -> ${dst}\n`)
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
  return flags.json ? <></> : <Text dimColor>Restoring database...</Text>
}
