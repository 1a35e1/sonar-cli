import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { gql } from '../../lib/client.js'
import { Spinner } from '../../components/Spinner.js'

type Props = {
  args: [string]
  options: {
    json: boolean
  }
}

const DELETE_MUTATION = `
  mutation DeleteTopic($nanoId: String!) {
    deleteTopic(nanoId: $nanoId)
  }
`

export default function TopicDelete({ args: [id], options: flags }: Props) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        await gql<{ deleteTopic: boolean }>(DELETE_MUTATION, { nanoId: id })

        if (flags.json) {
          process.stdout.write(JSON.stringify({ deleted: id }) + '\n')
          process.exit(0)
        }

        setDone(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
  }, [])

  if (error) return <Text color="red">Error: {error}</Text>
  if (!done) return <Spinner label="Deleting topic..." />

  return (
    <Box gap={1}>
      <Text color="green">Deleted</Text>
      <Text dimColor>{id}</Text>
    </Box>
  )
}
