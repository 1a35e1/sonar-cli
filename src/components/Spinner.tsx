import { useState, useEffect } from 'react'
import { Text } from 'ink'

// Sonar ping — radiates outward, resets
const FRAMES = [' ', ' ', '·', '•', '●', '◉', '◎', '○', ' ']

interface SpinnerProps {
  label?: string
}

export function Spinner({ label }: SpinnerProps) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, 100)
    return () => clearInterval(timer)
  }, [])

  return (
    <Text>
      <Text color="cyan">{FRAMES[frame]}</Text>
      {label ? <Text> {label}</Text> : null}
    </Text>
  )
}
