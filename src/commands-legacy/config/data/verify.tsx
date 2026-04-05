import React, { useEffect, useState } from 'react'
import zod from 'zod'
import { Text } from 'ink'
import { existsSync } from 'node:fs'
import { DB_PATH } from '../../../lib/db.js'
import { integrityCheck } from './utils.js'

export const options = zod.object({
  path: zod.string().optional().describe('Database path (default: local sonar DB path)'),
  json: zod.boolean().default(false).describe('Raw JSON output'),
})

type Props = { options: zod.infer<typeof options> }

export default function DataVerify({ options: flags }: Props) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const path = flags.path ?? DB_PATH
      if (!existsSync(path)) throw new Error(`database not found: ${path}`)
      const result = integrityCheck(path)
      const ok = result === 'ok'
      if (flags.json) {
        process.stdout.write(`${JSON.stringify({ ok, path, integrity: result }, null, 2)}\n`)
      } else {
        process.stdout.write(ok ? `Integrity check passed: ${path}\n` : `Integrity check failed: ${path} (${result})\n`)
      }
      process.exit(ok ? 0 : 1)
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
  return flags.json ? <></> : <Text dimColor>Verifying database...</Text>
}
