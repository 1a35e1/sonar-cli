import React, { useEffect } from 'react'
import zod from 'zod'
import { Text } from 'ink'
import { readAccounts, writeAccounts, migrateToAccounts } from '../../lib/config.js'

const ADJECTIVES = [
  'bouncy', 'cosmic', 'dizzy', 'fuzzy', 'gentle', 'happy', 'jazzy',
  'lucky', 'mellow', 'nimble', 'plucky', 'quiet', 'rusty', 'snappy',
  'tiny', 'vivid', 'witty', 'zesty', 'bright', 'clever',
]

const ANIMALS = [
  'rabbit', 'falcon', 'panda', 'otter', 'fox', 'wolf', 'eagle',
  'dolphin', 'tiger', 'koala', 'lynx', 'owl', 'raven', 'seal',
  'hawk', 'badger', 'crane', 'finch', 'heron', 'wren',
]

function randomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  return `${adj}-${animal}`
}

export const args = zod.tuple([
  zod.string().describe('API key (snr_...)'),
])

export const options = zod.object({
  alias: zod.string().optional().describe('Account alias (default: random)'),
  'api-url': zod.string().optional().describe('Custom API URL'),
})

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> }

export default function AccountAdd({ args: [key], options: flags }: Props) {
  useEffect(() => {
    migrateToAccounts()

    if (!key.startsWith('snr_')) {
      process.stderr.write('Invalid API key — must start with "snr_"\n')
      process.exit(1)
    }

    const data = readAccounts()
    let name = flags.alias ?? randomName()

    // Avoid collisions with existing names
    while (data.accounts[name]) {
      name = randomName()
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
