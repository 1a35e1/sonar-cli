import React, { useEffect } from 'react'
import zod from 'zod'
import { Text } from 'ink'
import { writeSkillTo } from '../../lib/skill.js'

export const options = zod.object({
  install: zod.boolean().default(false).describe('Install to ~/.claude/skills/sonar/SKILL.md'),
  dest: zod.string().optional().describe('Write to a custom path'),
})

type Props = { options: zod.infer<typeof options> }

export default function Skill({ options: flags }: Props) {
  useEffect(() => {
    writeSkillTo(flags.dest, flags.install)
  }, [])

  return <Text dimColor>Generating SKILL.md...</Text>
}
