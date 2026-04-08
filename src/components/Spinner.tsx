import { useState, useEffect } from 'react'
import { Text } from 'ink'
import spinners from 'unicode-animations'

const SPINNER = spinners.pulse

interface SpinnerProps {
  label?: string
}

export function Spinner({ label }: SpinnerProps) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER.frames.length)
    }, SPINNER.interval)
    return () => clearInterval(timer)
  }, [])

  return (
    <Text>
      <Text color="cyan">{SPINNER.frames[frame]}</Text>
      {label ? <Text> {label}</Text> : null}
    </Text>
  )
}
