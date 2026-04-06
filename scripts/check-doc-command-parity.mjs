import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SNAPSHOT_PATH = join(ROOT, '.drift', 'command-surface.snapshot.json')
const SKILL_PATH = join(ROOT, 'src', 'lib', 'skill.ts')
const README_PATH = join(ROOT, 'README.md')

function loadCommands() {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  return new Set(snapshot.commands)
}

function extractSonarCommands(text) {
  const matches = text.match(/^\s*sonar[^\n`#]*$/gm) ?? []
  return matches
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function normalizeExampleCommand(example, knownCommands) {
  // Drop inline comments and flags/args for command matching.
  const cleaned = example.split('#')[0].trim()
  const tokens = cleaned.split(/\s+/)

  // Try longest command prefix first.
  for (let i = Math.min(tokens.length, 4); i >= 1; i -= 1) {
    const candidate = tokens.slice(0, i).join(' ')
    if (knownCommands.has(candidate)) {
      return candidate
    }
  }
  return null
}

const known = loadCommands()

const docs = [
  { name: 'src/lib/skill.ts', content: readFileSync(SKILL_PATH, 'utf8') },
  { name: 'README.md', content: readFileSync(README_PATH, 'utf8') },
]

const unknownByFile = []

for (const doc of docs) {
  const raw = extractSonarCommands(doc.content)
  const unknown = raw.filter((line) => normalizeExampleCommand(line, known) === null)
  if (unknown.length > 0) {
    unknownByFile.push({ file: doc.name, unknown })
  }
}

if (unknownByFile.length > 0) {
  process.stderr.write('Found doc commands not present in CLI command surface:\n')
  for (const entry of unknownByFile) {
    process.stderr.write(`- ${entry.file}\n`)
    for (const line of entry.unknown) {
      process.stderr.write(`  - ${line}\n`)
    }
  }
  process.stderr.write(
    '\nUpdate docs/skill examples or command files, then refresh snapshot if needed.\n',
  )
  process.exit(1)
}

process.stdout.write('Docs and skill command examples match current CLI surface.\n')
