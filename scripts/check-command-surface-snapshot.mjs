import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const SNAPSHOT_PATH = join(ROOT, '.drift', 'command-surface.snapshot.json')

if (!existsSync(SNAPSHOT_PATH)) {
  process.stderr.write(
    `Missing snapshot at ${SNAPSHOT_PATH}\n` +
      'Run: pnpm drift:surface:update\n',
  )
  process.exit(1)
}

const before = readFileSync(SNAPSHOT_PATH, 'utf8')

const update = spawnSync(
  process.execPath,
  [join(ROOT, 'scripts', 'update-command-surface-snapshot.mjs')],
  { stdio: 'pipe', encoding: 'utf8' },
)

if (update.status !== 0) {
  process.stderr.write(update.stderr || update.stdout)
  process.exit(update.status ?? 1)
}

const after = readFileSync(SNAPSHOT_PATH, 'utf8')
if (before !== after) {
  process.stderr.write(
    'Command surface snapshot drift detected.\n' +
      'Run: pnpm drift:surface:update and commit the updated snapshot.\n',
  )
  process.exit(1)
}

process.stdout.write('Command surface snapshot is up to date.\n')
