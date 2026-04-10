import React, { useEffect } from 'react'
import { Text } from 'ink'
import { writeConfig, getVendor } from '../../lib/config.js'

type Props = {
  options: {
    key: string
    value: string
  }
}

export default function ConfigSet({ options: flags }: Props) {
  useEffect(() => {
    const { key, value } = flags

    if (key === 'vendor') {
      const vendor = getVendor(value)
      writeConfig({ vendor })
      process.stdout.write(`Vendor preference set to "${vendor}" in ~/.sonar/config.json\n`)
      process.exit(0)
    }

    if (key === 'feed-render') {
      writeConfig({ feedRender: value })
      process.stdout.write(`Feed render set to "${value}" in ~/.sonar/config.json\n`)
      process.exit(0)
    }

    if (key === 'feed-width') {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 20) {
        process.stderr.write('feed-width must be an integer >= 20\n')
        process.exit(1)
      }
      writeConfig({ feedWidth: n })
      process.stdout.write(`Feed width set to ${n} in ~/.sonar/config.json\n`)
      process.exit(0)
    }

    process.stderr.write(`Unknown config key "${key}". Supported keys: vendor, feed-render, feed-width\n`)
    process.exit(1)
  }, [])

  return <Text dimColor>Updating config...</Text>
}
