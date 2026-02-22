import { useEffect } from 'react'
import { configExists, deleteConfig, deleteDatabase } from '../../lib/config.js'
import { Text } from 'ink'
import zod from 'zod'

export const options = zod.object({
  confirm: zod.boolean().default(false).describe('Pass to confirm deletion'),
})

type Props = { options: zod.infer<typeof options> }

export default function Nuke({ options: flags }: Props) {
  useEffect(() => {
    if (configExists() && flags.confirm) {
      deleteConfig()
      deleteDatabase()

      process.stdout.write('Workspace deleted at ~/.sonar/config.json and ~/.sonar/database.sqlite\n')
      process.exit(0)
    }
  }, [])

  return <Text dimColor>Tip. (pass <Text color="cyan">--confirm</Text> to nuke)</Text>
}
