import React, { useEffect } from 'react'
import { Text } from 'ink'
import { writeConfig, configExists } from '../../lib/config.js'
import zod from 'zod'

export const options = zod.object({
  key: zod.string().describe('API key to use').optional(),
})

type Props = { options: zod.infer<typeof options> }

export default function Setup({ options: flags }: Props) {
  useEffect(() => {
    if (configExists()) {
      process.stderr.write('Workspace already initialised at ~/.sonar/config.json\n')
      process.exit(1)
    }

    const apiKey = flags.key
    const apiUrl = process.env.SONAR_API_URL

    if (!apiKey) {
      process.stderr.write('API key required. Run: sonar config setup --key=<YOUR_KEY>\n')
      process.exit(1)
    }

    writeConfig({
      token: apiKey,
      ...(apiUrl ? { apiUrl } : {}),
    })
    process.stdout.write('Workspace initialised at ~/.sonar/config.json\n')
    process.exit(0)
  }, [])

  return <Text dimColor>Initialising workspace...</Text>
}
