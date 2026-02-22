import React from 'react'
import { Box, Text } from 'ink'

type Row = Record<string, string | number | boolean | null | undefined>

interface TableProps {
  rows: Row[]
  columns?: string[]
}

export function Table({ rows, columns }: TableProps) {
  if (rows.length === 0) {
    return <Text dimColor>No results.</Text>
  }

  const cols = columns ?? Object.keys(rows[0])

  // Calculate column widths
  const widths: Record<string, number> = {}
  for (const col of cols) {
    widths[col] = col.length
  }
  for (const row of rows) {
    for (const col of cols) {
      const val = String(row[col] ?? '')
      if (val.length > widths[col]) {
        widths[col] = val.length
      }
    }
  }

  const pad = (str: string, width: number) => str.padEnd(width)

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        {cols.map((col, i) => (
          <Box key={col} marginRight={i < cols.length - 1 ? 2 : 0}>
            <Text bold color="cyan">
              {pad(col.toUpperCase(), widths[col])}
            </Text>
          </Box>
        ))}
      </Box>
      {/* Divider */}
      <Box>
        <Text dimColor>
          {cols.map((col) => '─'.repeat(widths[col])).join('  ')}
        </Text>
      </Box>
      {/* Rows */}
      {rows.map((row, i) => (
        <Box key={i}>
          {cols.map((col, j) => (
            <Box key={col} marginRight={j < cols.length - 1 ? 2 : 0}>
              <Text>{pad(String(row[col] ?? ''), widths[col])}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}
