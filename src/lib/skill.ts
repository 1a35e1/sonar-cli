import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

// SKILL.md lives at the package root — canonical, discoverable by indexers.
// At build time it's copied next to dist/ so published packages can find it.
function readSkillContent(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url))
  // Try package root (one level above dist/lib/ in published package, or src/lib/ in dev)
  const candidates = [
    join(moduleDir, '..', '..', 'SKILL.md'),      // dist/lib/skill.js → package root
    join(moduleDir, '..', '..', '..', 'SKILL.md'), // src/lib/skill.ts → repo root
  ]
  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path, 'utf8')
    }
  }
  throw new Error(
    `SKILL.md not found. Tried: ${candidates.join(', ')}. ` +
    `This is a packaging bug — SKILL.md should be bundled with the published CLI.`
  )
}

const DEFAULT_INSTALL_PATH = join(homedir(), '.claude', 'skills', 'sonar', 'SKILL.md')

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function safeWrite(target: string, content: string, force: boolean): void {
  if (existsSync(target) && !force) {
    const existing = readFileSync(target, 'utf8')
    if (existing === content) {
      process.stdout.write(`SKILL.md is already up to date: ${target}\n`)
      process.exit(0)
    }
    // File exists and differs — user may have customized it
    process.stderr.write(
      `SKILL.md has been modified: ${target}\n` +
      `Use --force to overwrite, or manually merge.\n` +
      `New version hash: ${sha256(content).slice(0, 8)}\n`
    )
    process.exit(1)
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, 'utf8')
  process.stdout.write(`SKILL.md written to ${target}\n`)
}

export function writeSkillTo(dest?: string, install?: boolean, force?: boolean): void {
  const content = readSkillContent()

  if (install || dest === '--install') {
    safeWrite(DEFAULT_INSTALL_PATH, content, force ?? false)
    process.exit(0)
  }

  if (dest) {
    safeWrite(dest, content, force ?? false)
    process.exit(0)
  }

  // Default: print to stdout
  process.stdout.write(content)
  process.exit(0)
}
