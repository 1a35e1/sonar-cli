import React, { useEffect } from 'react'
import { Text } from 'ink'
import { readAccounts, writeAccounts } from '../../lib/config.js'

type Props = {
  args: [string, string]
}

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
