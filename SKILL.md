---
name: sonar
description: Sonar CLI — view and triage your feed, manage topics, trigger refresh jobs, run lens analyses, and manage local Sonar data. Curated content from your X network using AI-powered filtering.
homepage: https://sonar.8640p.info
user-invocable: true
allowed-tools: Bash
argument-hint: [command and options]
metadata: {"openclaw":{"emoji":"📡","requires":{"bins":["sonar"]}}}
---

# Sonar CLI

Sonar surfaces relevant content from your X network, filtering your feed against topics you care about using AI pipelines (embeddings, LLM reranker, interest profiles). All commands are invoked as `sonar <command> [subcommand] [flags]`.

For agentic usage, most commands support `--json` for machine-readable output and `--no-interactive` for non-TTY environments.

## Core usage — triage suggestions

Default command shows a ranked stream of suggestions from your network matched to your topics:

```bash
sonar                                # interactive triage (default)
sonar --hours 24                     # widen time window
sonar --days 3                       # last 3 days
sonar --kind default                 # default | bookmarks | followers | following
sonar --render card                  # card | table
sonar --limit 50
sonar --width 100
sonar --json                         # raw JSON output
sonar --no-interactive               # disable for scripting
```

In interactive mode, keyboard shortcuts triage each item:
- `n` next · `s` save · `a` archive · `-` bad rec (with reason) · `o` open · `q` quit

## Feed — read-only view

Pull feed items without triage UI:

```bash
sonar feed                           # last 12h, limit 20
sonar feed --hours 48 --limit 50
sonar feed --days 3
sonar feed --kind bookmarks          # default | bookmarks | followers | following
sonar feed --render table
sonar feed --json
```

### Streaming with --follow

Poll for new items continuously. Great for LLM pipelines:

```bash
sonar feed --follow                  # visual cards, polls every 30s
sonar feed --follow --interval 10    # poll every 10s
sonar feed --follow --json           # NDJSON stream (one JSON per line)
sonar feed --follow --json | jq --unbuffered 'select(.score > 0.7)'
```

Press `q` to quit follow mode.

## Topics

Topics define what Sonar matches against. Specific beats generic — `"onchain governance mechanisms"` beats `"crypto"`.

```bash
sonar topics                                  # list all
sonar topics --json                           # JSON output
sonar topics add "AI agents"                  # add a topic
sonar topics view <id>                        # view details
sonar topics edit <id> --name "New Name"      # rename
sonar topics delete <id>                      # delete
```

### AI-powered topic suggestions

```bash
sonar topics suggest                          # interactive — y/n/q per suggestion
sonar topics suggest --count 3
sonar topics suggest --vendor anthropic       # use Anthropic instead of OpenAI
sonar topics suggest --json
```

Requires `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` depending on vendor.

## Refresh — trigger pipeline

```bash
sonar refresh                        # full pipeline (all steps)
sonar refresh --bookmarks            # sync bookmarks from X
sonar refresh --likes                # sync likes from X
sonar refresh --graph                # rebuild social graph
sonar refresh --tweets               # index tweets across network
sonar refresh --suggestions          # regenerate suggestions
sonar refresh --likes --bookmarks    # combine flags
sonar refresh --wait                 # auto-retry after rate limit
```

## Status

```bash
sonar status                         # account status, queue activity, pipeline progress
sonar status --watch                 # poll every 2s
sonar status --json
sonar status --wait                  # auto-retry after rate limit
```

## Triage actions (by ID)

```bash
sonar skip --id <suggestion_id>
sonar later --id <suggestion_id>
sonar archive --id <suggestion_id>
```

## Lens — AI analysis of local data (paid)

Requires paid plan + local embeddings. Run `sonar data pull` first to sync.

```bash
sonar lens blindspots --window 3d    # what your topics are missing
sonar lens emerging --window 3d      # small accounts gaining credibility
sonar lens experts --window 3d       # genuine domain experts per topic
sonar lens contrarian --window 3d    # credible disagreements with consensus
sonar lens diff --window 3d          # narrative shifts over time
```

All lens commands accept `--vendor openai|anthropic`, `--json`, and `--window`.

## Data — local sync and export

```bash
sonar data pull                      # sync feed/suggestions/topics to local SQLite
sonar data pull --force              # wipe and re-pull everything
sonar data pull --debug              # show request timing

sonar data export --format json --window 1d
sonar data export --format csv --window 3d
sonar data export --format json --window 1w

sonar data path                      # show local DB location
sonar data verify                    # integrity check
sonar data backup                    # backup local DB
sonar data backup --out <path>
sonar data restore --from <path>     # restore from backup
```

Local DB lives at `~/.sonar/data.db`. Use it with any SQLite tool for custom analysis.

## Account

```bash
sonar account                        # list accounts, * marks active
sonar account add <api_key>          # add account
sonar account add <api_key> --alias work
sonar account switch <name>          # switch active account
sonar account rename <old> <new>
sonar account remove <name>          # --force if active
```

## Config

```bash
sonar config                         # show current config
sonar config set vendor openai       # set AI vendor
sonar config set vendor anthropic
sonar config skill --install         # install this skill to ~/.claude/skills/sonar/
sonar config skill --install --force # overwrite existing
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| `SONAR_API_URL` | Backend GraphQL endpoint (defaults to production) |
| `SONAR_MAX_RETRIES` | Max retries on transient failures (default 3, 0 to disable) |
| `OPENAI_API_KEY` | Required for `topics suggest` / `lens` with OpenAI vendor |
| `ANTHROPIC_API_KEY` | Required for `topics suggest` / `lens` with Anthropic vendor |

## Agent recipes

Common patterns for scripting:

```bash
# Morning briefing as JSON
sonar feed --hours 8 --json

# High-signal items only
sonar feed --days 1 --json | jq '.[] | select(.score > 0.7)'

# Extract author + text for LLM summarization
sonar feed --hours 24 --json | jq '.[] | {author: .tweet.user.username, text: .tweet.text}'

# Stream high-score items to a file
sonar feed --follow --json | jq --unbuffered 'select(.score > 0.7)' >> highlights.jsonl

# Export for offline analysis
sonar data pull && sqlite3 ~/.sonar/data.db "SELECT * FROM suggestions ORDER BY similarity DESC LIMIT 20"
```

## Typical setup

1. Get an API key at https://sonar.8640p.info/
2. `sonar account add <key>`
3. `sonar topics add "AI agents"` (add 2-5 topics)
4. `sonar refresh` (first run indexes your network — takes a few minutes)
5. `sonar status --watch` to monitor
6. `sonar` to triage results
