import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Text } from 'ink'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { DB_PATH } from '../../../lib/db.js'
import { integrityCheck, copyDbWithSidecars } from './utils.js'

export const options = zod.object({
  from: zod.string().describe('Backup database path to restore from'),
  to: zod.string().optional().describe('Target database path (default: local sonar DB path)'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
})

type Props = { options: zod.infer<typeof options> }

export default function DataRestore({ options: flags }: Props) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const src = resolve(flags.from)
      const dst = resolve(flags.to ?? DB_PATH)

      // Guard: prevent copying a file onto itself, which would corrupt the DB.
      if (src === dst) {
        throw new Error(
          `Source and destination resolve to the same path: ${src}\n` +
          'Specify a different --to path.'
        )
      }

      if (!existsSync(src)) throw new Error(`backup not found: ${src}`)

      // Verify the backup is healthy before touching anything.
      const srcCheck = integrityCheck(src)
      if (srcCheck !== 'ok') throw new Error(`backup integrity check failed: ${srcCheck}`)

      mkdirSync(dst.replace(/\/[^/]+$/, '') || '.', { recursive: true })

      // Snapshot the current DB — including WAL/SHM sidecars — so we have
      // a complete, self-consistent point-in-time snapshot to roll back to if
      // anything goes wrong during the restore.
      const preRestore = existsSync(dst) ? `${dst}.pre-restore.${Date.now()}` : null
      if (preRestore) {
        copyDbWithSidecars(dst, preRestore)
      }

      // Copy backup → destination (main DB + any sidecars).
      copyDbWithSidecars(src, dst)

      // Verify the restored DB before declaring success.
      const dstCheck = integrityCheck(dst)
      if (dstCheck !== 'ok') {
        // The restored file is corrupt. Roll back to the pre-restore snapshot
        // so we don't leave the user with a broken local database.
        if (preRestore && existsSync(preRestore)) {
          copyDbWithSidecars(preRestore, dst)
          for (const ext of ['-wal', '-shm']) {
            rmSync(`${preRestore}${ext}`, { force: true })
          }
          rmSync(preRestore, { force: true })
          throw new Error(
            `Restored database failed integrity check (${dstCheck}). ` +
            'Rolled back to the previous database — your data is intact.'
          )
        }
        throw new Error(`restored database integrity check failed: ${dstCheck}`)
      }

      // Clean up the pre-restore snapshot on success.
      if (preRestore) {
        for (const ext of ['-wal', '-shm']) {
          rmSync(`${preRestore}${ext}`, { force: true })
        }
        rmSync(preRestore, { force: true })
      }

      const result = { ok: true, from: src, to: dst }
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
