import React from 'react'
import { Box, Text } from 'ink'
import { readAccounts, migrateToAccounts } from '../../lib/config.js'

type Props = {
  options: {
    json: boolean
  }
}

function maskToken(token: string): string {
  if (token.length <= 8) return '***'
  return token.slice(0, 4) + '...' + token.slice(-4)
}

export default function AccountList({ options: flags }: Props) {
  migrateToAccounts()
  const { active, accounts } = readAccounts()
  const names = Object.keys(accounts)

  if (flags.json) {
    process.stdout.write(JSON.stringify({ active, accounts: names }, null, 2) + '\n')
    process.exit(0)
    return <></>
  }

  if (names.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text>No accounts configured.</Text>
        <Box flexDirection="column">
          <Text dimColor>  sonar account add snr_xxxxx</Text>
          <Text dimColor>  sonar account add snr_yyyyy --alias work</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text bold>Accounts</Text>
        <Text dimColor> ({names.length})</Text>
      </Box>
      {names.map(name => {
        const isActive = name === active
        const entry = accounts[name]
        return (
          <Box key={name} gap={2}>
            <Text color={isActive ? 'green' : undefined}>
              {isActive ? '* ' : '  '}{name}
            </Text>
            <Text dimColor>{maskToken(entry.token)}</Text>
            {entry.apiUrl !== 'https://api.sonar.8640p.info/graphql' && (
              <Text dimColor>{entry.apiUrl}</Text>
            )}
          </Box>
        )
      })}
      <Text dimColor>switch: sonar account switch &lt;name&gt;</Text>
    </Box>
  )
}
