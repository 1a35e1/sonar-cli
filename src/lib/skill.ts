import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

const SKILL_CONTENT = `---
name: sonar
description: Sonar CLI — manage interests, suggestions, indexing jobs, and account config for the Sonar social intelligence platform. Use when the user asks about their Sonar account, wants to create/list interests, check suggestions, trigger indexing, or configure the CLI.
homepage: https://sonar.sh
user-invocable: true
allowed-tools: Bash
argument-hint: [command and options]
metadata: {"openclaw":{"emoji":"📡","primaryEnv":"SONAR_API_KEY","requires":{"bins":["sonar"],"env":["SONAR_API_KEY"]}}}
---

# Sonar CLI

Sonar is a social intelligence platform. Use the \`sonar\` CLI to manage the user's account.

All commands are invoked as: \`sonar <command> [subcommand] [flags]\`

---

## Account & Config

\`\`\`bash
# Show account info, plan usage, and suggestion counts
sonar account

# Show current CLI config (API URL, vendor, token presence)
sonar config

# Set AI vendor preference for --from-prompt (saved to ~/.sonar/config.json)
sonar config set vendor openai      # or: anthropic

# Initialise workspace from environment variables
# Requires: SONAR_API_KEY
sonar config setup
\`\`\`

---

## Interests

Interests are named topic areas with keywords and related topics that drive suggestion matching.

\`\`\`bash
# List all interests
sonar interests

# Create manually
sonar interests create --name "AI Agents" --description "LLM-based agents and tooling" \\
  --keywords "agents,llm,tools,mcp" --topics "machine learning,AI safety"

# Generate fields from a natural language prompt (uses OPENAI_API_KEY or ANTHROPIC_API_KEY)
sonar interests create --from-prompt "I want to follow the Rust ecosystem and systems programming"

# Generate with a specific vendor (overrides config preference)
sonar interests create --from-prompt "DeFi and crypto protocols" --vendor anthropic

# Update an existing interest (full replace)
sonar interests update --id <id> --name "New Name" --keywords "kw1,kw2"

# Add keywords to an existing interest (fetches current, merges, sends full list)
sonar interests update --id <id> --add-keywords "mcp,a2a,langgraph"

# Remove keywords from an existing interest
sonar interests update --id <id> --remove-keywords "old-term,deprecated-kw"

# Add and remove keywords in one shot
sonar interests update --id <id> --add-keywords "vibe-coding" --remove-keywords "cursor"

# Same flags work for related topics
sonar interests update --id <id> --add-topics "AI safety" --remove-topics "machine learning"

# Combine keyword/topic patching with a name change
sonar interests update --id <id> --name "New Name" --add-keywords "new-kw"

# Regenerate all fields from a new prompt (replaces everything)
sonar interests update --id <id> --from-prompt "Rust and WebAssembly tooling"

# Output raw JSON (agent-friendly)
sonar interests --json
\`\`\`

**AI vendor resolution order:**
1. \`--vendor\` flag
2. \`SONAR_AI_VENDOR\` environment variable
3. \`vendor\` in \`~/.sonar/config.json\` (set via \`sonar config set vendor\`)
4. Defaults to \`openai\`

Required env vars: \`OPENAI_API_KEY\` (OpenAI) or \`ANTHROPIC_API_KEY\` (Anthropic)

---

## Feed

Scored tweet feed from your social network, filtered by interests.

\`\`\`bash
# Show feed (default: last 12h, limit 20, card layout)
sonar feed

# Time window
sonar feed --hours 24
sonar feed --days 3

# Limit results
sonar feed --limit 50

# Output layout
sonar feed --render card    # default — rich card view
sonar feed --render table   # compact table view
sonar feed --width 100      # card body width in columns

# Raw JSON output (agent-friendly)
sonar feed --json
\`\`\`

---

## Suggestions (inbox)

\`\`\`bash
# List suggestions (default: inbox, limit 20)
sonar inbox

# Filter by status
sonar inbox --status inbox
sonar inbox --status later
sonar inbox --status replied
sonar inbox --status archived

# Change limit
sonar inbox --limit 50

# Update a suggestion's status (positional id replaced with --id flag)
sonar inbox read --id <id>
sonar inbox skip --id <id>
sonar inbox later --id <id>
sonar inbox archive --id <id>

# Raw JSON output
sonar inbox --json
\`\`\`

---

## Ingest

Trigger background jobs to ingest data.

\`\`\`bash
# Trigger specific jobs
sonar ingest tweets        # Ingest recent tweets from social graph
sonar ingest bookmarks     # Ingest X bookmarks (requires OAuth token)
sonar interests match      # Match interests against ingested tweets (default: last 24h)

# Match tweet window (capped by plan: free=3d, pro=7d, enterprise=14d)
sonar interests match --days 1   # default
sonar interests match --days 3   # broader window (free plan max)
sonar interests match --days 7   # pro plan max

# Show current job queue counts (one-shot)
sonar monitor

# Live polling view of job queues
sonar monitor --watch
\`\`\`

---

## Local Data

Sync feed, suggestions, and interests to a local SQLite DB (\`~/.sonar/data.db\`) for offline querying.

\`\`\`bash
# Full download — wipes and repopulates ~/.sonar/data.db
sonar config data download

# Incremental sync — upserts records newer than last sync
sonar config data sync

# Open an interactive sqlite3 REPL
sonar config data sql

# Print path to the local DB file
sonar config data path
\`\`\`

### Schema

\`\`\`sql
-- Core tweet content (shared by feed and suggestions)
tweets (
  id TEXT PRIMARY KEY,       -- Sonar tweet UUID
  xid TEXT,                  -- Twitter/X tweet ID
  text TEXT,
  created_at TEXT,
  like_count INTEGER,
  retweet_count INTEGER,
  reply_count INTEGER,
  author_username TEXT,
  author_display_name TEXT,
  author_followers_count INTEGER,
  author_following_count INTEGER
)

-- Feed items (scored, keyword-matched tweets)
feed_items (
  tweet_id TEXT PRIMARY KEY, -- FK → tweets.id
  score REAL,
  matched_keywords TEXT,     -- JSON array of strings
  synced_at TEXT
)

-- Inbox suggestions
suggestions (
  suggestion_id TEXT PRIMARY KEY,
  tweet_id TEXT,             -- FK → tweets.id
  score REAL,
  status TEXT,               -- INBOX | READ | SKIPPED | LATER | ARCHIVED
  relevance TEXT,
  projects_matched TEXT,     -- JSON (count of matched interests)
  metadata TEXT,             -- JSON
  synced_at TEXT
)

-- Interests (topics/keywords that drive matching)
interests (
  id TEXT PRIMARY KEY,       -- nanoId
  name TEXT,
  description TEXT,
  keywords TEXT,             -- JSON array
  topics TEXT,               -- JSON array
  created_at TEXT,
  updated_at TEXT,
  synced_at TEXT
)

-- Internal sync state
sync_state (
  key TEXT PRIMARY KEY,      -- e.g. "last_synced_at"
  value TEXT
)
\`\`\`

---

## Environment Variables

| Variable | Purpose |
|---|---|
| \`SONAR_API_KEY\` | API key for authentication (overrides config file) |
| \`SONAR_API_URL\` | Backend URL (default: \`http://localhost:8000/graphql\`) |
| \`SONAR_AI_VENDOR\` | AI vendor for \`--from-prompt\` (overrides config file) |
| \`OPENAI_API_KEY\` | Required when vendor is \`openai\` |
| \`ANTHROPIC_API_KEY\` | Required when vendor is \`anthropic\` |

---

## Config file

Stored at \`~/.sonar/config.json\`:

\`\`\`json
{
  "token": "snr_...",
  "apiUrl": "https://api.sonar.sh/graphql",
  "vendor": "openai"
}
\`\`\`
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
