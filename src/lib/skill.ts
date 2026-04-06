import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

const SKILL_CONTENT = `---
name: sonar
description: Sonar CLI — view and triage your feed, manage topics, trigger refresh jobs, and manage local Sonar config/data.
homepage: https://sonar.sh
user-invocable: true
allowed-tools: Bash
argument-hint: [command and options]
metadata: {"openclaw":{"emoji":"📡","primaryEnv":"SONAR_API_KEY","requires":{"bins":["sonar"],"env":["SONAR_API_KEY"]}}}
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
| \`SONAR_API_KEY\` | API key for auth (overrides config file token) |
| \`SONAR_API_URL\` | Backend URL (defaults to production GraphQL endpoint) |
| \`SONAR_AI_VENDOR\` | Vendor override for AI-assisted operations (\`openai\` or \`anthropic\`) |
| \`SONAR_FEED_RENDER\` | Default feed renderer override |
| \`SONAR_FEED_WIDTH\` | Default card width override |
| \`OPENAI_API_KEY\` | Required when vendor is \`openai\` |
| \`ANTHROPIC_API_KEY\` | Required when vendor is \`anthropic\` |
`

const DEFAULT_INSTALL_PATH = join(homedir(), '.claude', 'skills', 'sonar', 'SKILL.md')

export function writeSkillTo(dest?: string, install?: boolean): void {
  if (install || dest === '--install') {
    const target = DEFAULT_INSTALL_PATH
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, SKILL_CONTENT, 'utf8')
    process.stdout.write(`SKILL.md written to ${target}\n`)
    process.exit(0)
  }

  if (dest) {
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, SKILL_CONTENT, 'utf8')
    process.stdout.write(`SKILL.md written to ${dest}\n`)
    process.exit(0)
  }

  // Default: print to stdout
  process.stdout.write(SKILL_CONTENT)
  process.exit(0)
}
