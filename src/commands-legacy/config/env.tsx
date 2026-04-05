import { useEffect } from 'react'
import { Text } from 'ink'

const maskSensitive = (value: string) => {
  return value.replace(/[^a-zA-Z0-9]/g, '*').slice(0, 4) + '***' + value.slice(-4)
}

export default function Env() {
  useEffect(() => {
    process.stdout.write(`SONAR_API_KEY=${maskSensitive(process.env.SONAR_API_KEY ?? '')}\n`)
    process.stdout.write(`SONAR_AI_VENDOR=${process.env.SONAR_AI_VENDOR}\n`)
    process.stdout.write(`SONAR_FEED_RENDER=${process.env.SONAR_FEED_RENDER}\n`)
    process.stdout.write(`SONAR_FEED_WIDTH=${process.env.SONAR_FEED_WIDTH}\n`)
  }, [])

  return <Text dimColor>Environment variables:</Text>
}
