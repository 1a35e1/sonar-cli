import React, { useEffect } from 'react'
import { Text } from 'ink'
import { spawnSync } from 'node:child_process'
import { DB_PATH } from '../../../lib/db.js'

export default function DataSql() {
  useEffect(() => {
    const { status } = spawnSync('sqlite3', [DB_PATH], { stdio: 'inherit' })
    process.exit(status ?? 0)
  }, [])

  return <Text dimColor>Opening sqlite3...</Text>
}
