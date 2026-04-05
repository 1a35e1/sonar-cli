import React, { useEffect } from 'react'
import { Text } from 'ink'
import { readConfig } from '../../lib/config.js'

export default function Config() {
  useEffect(() => {
    const cfg = readConfig()
    process.stdout.write(`${JSON.stringify({ apiUrl: cfg.apiUrl, vendor: cfg.vendor ?? 'openai', feedRender: cfg.feedRender ?? 'card', feedWidth: cfg.feedWidth ?? 80, hasToken: !!cfg.token }, null, 2)}\n`)
    process.exit(0)
  }, [])

  return <Text dimColor>Reading config...</Text>
}
