import React, { useEffect } from 'react'
import zod from 'zod'
import { Text } from 'ink'
import { readAccounts, writeAccounts } from '../../lib/config.js'

export const args = zod.tuple([
  zod.string().describe('Current account name'),
  zod.string().describe('New account name'),
])

type Props = { args: zod.infer<typeof args> }

export default function AccountRename({ args: [oldName, newName] }: Props) {
  useEffect(() => {
    const data = readAccounts()

    if (!data.accounts[oldName]) {
      const names = Object.keys(data.accounts)
      process.stderr.write(`Account "${oldName}" not found.`)
      if (names.length > 0) process.stderr.write(` Available: ${names.join(', ')}`)
      process.stderr.write('\n')
      process.exit(1)
    }

    if (data.accounts[newName]) {
      process.stderr.write(`Account "${newName}" already exists.\n`)
      process.exit(1)
    }

    data.accounts[newName] = data.accounts[oldName]
    delete data.accounts[oldName]

    if (data.active === oldName) {
      data.active = newName
    }

    writeAccounts(data)
    process.stdout.write(`Renamed "${oldName}" → "${newName}"\n`)
    process.exit(0)
  }, [])

  return <Text dimColor>Renaming account...</Text>
}
