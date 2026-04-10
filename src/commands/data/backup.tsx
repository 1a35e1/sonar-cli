import React, { useEffect, useState } from 'react'
import { Text } from 'ink'
import { existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { DB_PATH } from '../../lib/db.js'
import { integrityCheck, copyDbWithSidecars } from '../../lib/data-utils.js'

type Props = {
  options: {
    out?: string
    json: boolean
  }
}

function ts(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}

export default function DataBackup({ options: flags }: Props) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (!existsSync(DB_PATH)) throw new Error(`source database not found: ${DB_PATH}`)

      const trimmedOut = flags.out?.trim()
      const out = trimmedOut && trimmedOut.length > 0
        ? trimmedOut
        : join(dirname(DB_PATH), `${basename(DB_PATH, '.db')}-backup-${ts()}.db`)

      mkdirSync(dirname(out), { recursive: true })

      copyDbWithSidecars(DB_PATH, out)

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
