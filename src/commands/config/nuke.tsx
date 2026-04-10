import { useEffect } from 'react'
import { configExists, deleteConfig, deleteDatabase } from '../../lib/config.js'
import { Text } from 'ink'
import { existsSync } from 'node:fs'
import { DB_PATH } from '../../lib/db.js'

type Props = {
  options: {
    confirm: boolean
  }
}

export default function Nuke({ options: flags }: Props) {
  useEffect(() => {
    if (!flags.confirm) {
      return
    }

    const hadConfig = configExists()
    const hadDb = existsSync(DB_PATH)

    if (hadConfig) {
      deleteConfig()
    }
    if (hadDb) {
      deleteDatabase()
    }

    if (!hadConfig && !hadDb) {
      process.stdout.write('Nothing to delete. No local Sonar config or data database found.\n')
      process.exit(0)
    }

    const deleted: string[] = []
    if (hadConfig) deleted.push('~/.sonar/config.json')
    if (hadDb) deleted.push(DB_PATH)

    process.stdout.write(`Deleted: ${deleted.join(', ')}\n`)
    process.exit(0)
  }, [])

  return <Text dimColor>Tip. (pass <Text color="cyan">--confirm</Text> to nuke)</Text>
}
