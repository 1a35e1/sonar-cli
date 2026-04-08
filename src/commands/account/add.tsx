import React, { useEffect } from 'react'
import zod from 'zod'
import { Text } from 'ink'
import { readAccounts, writeAccounts, migrateToAccounts } from '../../lib/config.js'

export const args = zod.tuple([
  zod.string().describe('Account name (e.g. personal, work)'),
  zod.string().describe('API key (snr_...)'),
])

export const options = zod.object({
  'api-url': zod.string().optional().describe('Custom API URL'),
})

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> }

export default function AccountAdd({ args: [name, key], options: flags }: Props) {
  useEffect(() => {
    migrateToAccounts()

    if (!key.startsWith('snr_')) {
      process.stderr.write('Invalid API key — must start with "snr_"\n')
      process.exit(1)
    }

    const data = readAccounts()

    if (data.accounts[name]) {
      process.stderr.write(`Account "${name}" already exists. Remove it first or choose a different name.\n`)
      process.exit(1)
    }

    data.accounts[name] = {
      token: key,
      apiUrl: flags['api-url'] ?? 'https://api.sonar.8640p.info/graphql',
    }

    // If this is the first account, make it active
    if (!data.active || !data.accounts[data.active]) {
      data.active = name
    }

    writeAccounts(data)
    process.stdout.write(`Account "${name}" added${data.active === name ? ' (active)' : ''}\n`)
    process.exit(0)
  }, [])

  return <Text dimColor>Adding account...</Text>
}
