export function parseWindow(w: string): string {
  const m = w.match(/^(\d+)\s*(h|d|w)$/i)
  if (!m) {
    process.stderr.write(`Invalid window "${w}" — use e.g. 3d, 12h, 1w\n`)
    process.exit(1)
  }
  const n = Number(m[1])
  const unit = m[2].toLowerCase()
  if (unit === 'h') return `-${n} hours`
  if (unit === 'w') return `-${n * 7} days`
  return `-${n} days`
}
