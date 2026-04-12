/**
 * Terminal plotting helpers — unicode bar charts and sparklines.
 * No external dependencies.
 */

/**
 * Horizontal bar chart segment for a single row.
 * Returns a unicode block string scaled to `width`.
 */
export function hBar(value: number, max: number, width = 30): string {
  if (max <= 0) return ''.padEnd(width, '░')
  const filled = Math.round((value / max) * width)
  const empty = width - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

/**
 * Sparkline for time series. Uses 8 levels of block height.
 */
const SPARK_CHARS = '▁▂▃▄▅▆▇█'

export function sparkline(values: number[]): string {
  if (values.length === 0) return ''
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  return values
    .map((v) => {
      const normalized = (v - min) / range
      const idx = Math.min(
        SPARK_CHARS.length - 1,
        Math.floor(normalized * SPARK_CHARS.length),
      )
      return SPARK_CHARS[idx]
    })
    .join('')
}

/**
 * Bucket values into `count` equal-width buckets from min..max.
 * Returns the count in each bucket.
 */
export function bucketize(values: number[], count: number): number[] {
  if (values.length === 0) return new Array(count).fill(0)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const buckets = new Array(count).fill(0)
  for (const v of values) {
    const normalized = (v - min) / range
    const idx = Math.min(count - 1, Math.floor(normalized * count))
    buckets[idx]++
  }
  return buckets
}

/**
 * Format a number with K/M suffix for compact display.
 */
export function compactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}
