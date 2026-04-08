import { useEffect } from 'react'
import { Text } from 'ink'

export default function Env() {
  useEffect(() => {
    process.stdout.write(`SONAR_API_URL=${process.env.SONAR_API_URL ?? ''}\n`)
    process.stdout.write(`SONAR_AI_VENDOR=${process.env.SONAR_AI_VENDOR ?? ''}\n`)
    process.stdout.write(`SONAR_FEED_RENDER=${process.env.SONAR_FEED_RENDER ?? ''}\n`)
    process.stdout.write(`SONAR_FEED_WIDTH=${process.env.SONAR_FEED_WIDTH ?? ''}\n`)
    process.stdout.write(`SONAR_MAX_RETRIES=${process.env.SONAR_MAX_RETRIES ?? ''}\n`)
  }, [])

  return <Text dimColor>Environment variables:</Text>
}
