import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

const SKILL_CONTENT = `---
name: sonar
description: Sonar CLI — view and triage your feed, manage topics, trigger refresh jobs, and manage local Sonar config/data.
homepage: https://sonar.sh
user-invocable: true
allowed-tools: Bash
argument-hint: [command and options]
metadata: {"openclaw":{"emoji":"📡","requires":{"bins":["sonar"]}}}
---

# Sonar CLI

All commands are invoked as: \`sonar <command> [subcommand] [flags]\`.

## Core usage

\`\`\`bash
# Default view (combined ranked stream from feed + inbox)
sonar
sonar --hours 24
sonar --days 3
sonar --kind default            # default | bookmarks | followers | following
sonar --limit 50
sonar --render card             # card | table
sonar --width 100
sonar --json
sonar --no-interactive
\`\`\`

## Topic management

\`\`\`bash
# List topics
sonar topics
sonar topics --json

# Add/update topics
sonar topics add "AI agents"
sonar topics add "Rust systems programming" --description "..."
sonar topics edit --id <topic_id> --name "New Name"
sonar topics edit --id <topic_id> --description "Updated description"
sonar topics edit --id <topic_id> --json
\`\`\`

## Pipeline and triage

\`\`\`bash
# Trigger full refresh pipeline
sonar refresh

# Monitor account + queues
sonar status
sonar status --watch
sonar status --json

# Suggestion actions
sonar archive --id <suggestion_id>
sonar later --id <suggestion_id>
sonar skip --id <suggestion_id>
\`\`\`

## Config and local data

\`\`\`bash
# Show and setup config
sonar config
sonar config setup key=<API_KEY>
sonar config env
sonar config set vendor openai
sonar config set vendor anthropic
sonar config set feed-render card
sonar config set feed-width 100

# Local sqlite data
sonar config data download
sonar config data sync
sonar config data path
sonar config data sql
sonar config data backup [--out <path>]
sonar config data restore --from <backup_path> [--to <path>]
sonar config data verify [--path <db_path>]

# Export this skill file
sonar config skill --install
\`\`\`

## Other commands

\`\`\`bash
# Queue bookmark sync
sonar sync bookmarks

# Delete local config + local DB (requires explicit confirmation)
sonar config nuke --confirm
\`\`\`

## Environment variables

| Variable | Purpose |
|---|---|
| \`SONAR_API_URL\` | Backend URL (defaults to production GraphQL endpoint) |
| \`SONAR_AI_VENDOR\` | Vendor override for AI-assisted operations (\`openai\` or \`anthropic\`) |
| \`SONAR_FEED_RENDER\` | Default feed renderer override |
| \`SONAR_FEED_WIDTH\` | Default card width override |
| \`OPENAI_API_KEY\` | Required when vendor is \`openai\` |
| \`ANTHROPIC_API_KEY\` | Required when vendor is \`anthropic\` |
`

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
  if (install || dest === '--install') {
    safeWrite(DEFAULT_INSTALL_PATH, SKILL_CONTENT, force ?? false)
    process.exit(0)
  }

  if (dest) {
    safeWrite(dest, SKILL_CONTENT, force ?? false)
    process.exit(0)
  }

  // Default: print to stdout
  process.stdout.write(SKILL_CONTENT)
  process.exit(0)
}
