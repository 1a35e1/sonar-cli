import React, { useEffect } from 'react'
import { Text } from 'ink'
import { DB_PATH } from '../../../lib/db.js'

export default function DataPath() {
  useEffect(() => {
    process.stdout.write(`${DB_PATH}\n`)
    process.exit(0)
  }, [])

  return <Text>{DB_PATH}</Text>
}
