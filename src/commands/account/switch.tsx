import React, { useEffect } from 'react'
import { Text } from 'ink'
import { readAccounts, writeAccounts } from '../../lib/config.js'

type Props = {
  args: [string]
}

export default function AccountSwitch({ args: [name] }: Props) {
  useEffect(() => {
    const data = readAccounts()

    if (!data.accounts[name]) {
      const names = Object.keys(data.accounts)
      process.stderr.write(`Account "${name}" not found.`)
      if (names.length > 0) {
        process.stderr.write(` Available: ${names.join(', ')}`)
      }
      process.stderr.write('\n')
      process.exit(1)
    }

    data.active = name
    writeAccounts(data)
    process.stdout.write(`Switched to "${name}"\n`)
    process.exit(0)
  }, [])

  return <Text dimColor>Switching account...</Text>
}
