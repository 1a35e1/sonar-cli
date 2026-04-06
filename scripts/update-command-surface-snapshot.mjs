import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'

const ROOT = process.cwd()
const COMMANDS_DIR = join(ROOT, 'src', 'commands')
const SNAPSHOT_PATH = join(ROOT, '.drift', 'command-surface.snapshot.json')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.isFile() && full.endsWith('.tsx')) out.push(full)
  }
  return out
}

function fileToCommand(filePath) {
  const rel = relative(COMMANDS_DIR, filePath).replace(/\\/g, '/')
  const withoutExt = rel.replace(/\.tsx$/, '')
  const parts = withoutExt.split('/')
  if (parts[parts.length - 1] === 'index') {
    parts.pop()
  }

  const commandParts = ['sonar', ...parts].filter(Boolean)
  return commandParts.join(' ')
}

const commandFiles = walk(COMMANDS_DIR)
const commands = Array.from(new Set(commandFiles.map(fileToCommand))).sort()

const payload = {
  source: 'src/commands/**/*.tsx',
  commandCount: commands.length,
  commands,
}

mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true })
writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

process.stdout.write(`Updated snapshot: ${SNAPSHOT_PATH}\n`)
process.stdout.write(`Commands: ${commands.length}\n`)
