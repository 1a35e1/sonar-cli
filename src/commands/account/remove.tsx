import React, { useEffect } from 'react'
import zod from 'zod'
import { Text } from 'ink'
import { readAccounts, writeAccounts } from '../../lib/config.js'

export const args = zod.tuple([
  zod.string().describe('Account name to remove'),
])

export const options = zod.object({
  force: zod.boolean().default(false).describe('Remove even if active'),
})

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> }

export default function AccountRemove({ args: [name], options: flags }: Props) {
  useEffect(() => {
    const data = readAccounts()

    if (!data.accounts[name]) {
      process.stderr.write(`Account "${name}" not found.\n`)
      process.exit(1)
    }

    if (data.active === name && !flags.force) {
      process.stderr.write(`"${name}" is the active account. Switch first, or use --force.\n`)
      process.exit(1)
    }

    delete data.accounts[name]

    // If we removed the active account, pick the first remaining one
    if (data.active === name) {
      const remaining = Object.keys(data.accounts)
      data.active = remaining.length > 0 ? remaining[0] : ''
    }

    writeAccounts(data)
    process.stdout.write(`Account "${name}" removed\n`)
    process.exit(0)
  }, [])

  return <Text dimColor>Removing account...</Text>
}
