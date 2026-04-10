import React, { useEffect } from 'react'
import { Text } from 'ink'
import { writeSkillTo } from '../../lib/skill.js'

type Props = {
  options: {
    install: boolean
    dest?: string
    force: boolean
  }
}

export default function Skill({ options: flags }: Props) {
  useEffect(() => {
    writeSkillTo(flags.dest, flags.install, flags.force)
  }, [])

  return <Text dimColor>Generating SKILL.md...</Text>
}
