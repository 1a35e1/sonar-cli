# 🔊 Sonar (Alpha)

Agent optimised [X](https://x.com) CLI for founders who want to stay ahead of the curve.

We got tired of missing important content in our feed and built Sonar to fix it.

Sonar matches your interests from your X network, filtering only relevant content from your graph using a variety of AI pipelines. We built this to automate our social intelligence at [@LighthouseGov](https://x.com/LighthouseGov).

## Get started

* Login with your `X` account to obtain a [free API key](https://sonar.8640p.info/).

Install the CLI

```sh
pnpm add -g @1a35e1/sonar-cli@latest
```

Register your API key.

```sh
# Ensure "SONAR_API_KEY" available in your env
export SONAR_API_KEY=snr_xxxxx

# or, manually register
sonar config setup key=<YOUR_API_KEY>
```

View your account status:

```sh
sonar status
```

Run your first refresh to index tweets and generate suggestions:

> The first time you run this it will take some time.

```sh
sonar refresh
sonar status --watch
```

---

## Scopes

* We currently request `read:*` and `offline:processing` scopes
* This allows us to read your feed, bookmarks, followers/following, and other account data to power our signal filtering and topic suggestions.


## Use cases

### Morning briefing in one command

Pull everything relevant that happened while you slept:

```bash
sonar feed --hours 8
```

### Stream your feed in real time

Watch for new items as they appear:

```bash
sonar feed --follow                      # visual cards, polls every 30s
sonar feed --follow --json | jq .score   # NDJSON stream for agents
```

### Discover new topics with AI

Let Sonar suggest topics based on your interests and feed:

```bash
sonar topics suggest                 # interactive accept/reject
sonar topics suggest --count 3       # just 3 suggestions
```

### Track a topic you care about

Add a topic, then refresh:

```bash
sonar topics add "AI agents"
sonar refresh
sonar feed --hours 24
```

Sonar rebuilds your social graph, indexes recent tweets, and generates suggestions matched against your topics and interest profile.

### Build a scriptable news digest

Combine `--json` output with `jq` to pipe Sonar content wherever you want:

```bash
# Get today's feed as JSON
sonar feed --hours 24 --json | jq '.[] | {author: .tweet.user.username, text: .tweet.text}'

# Summarize with an LLM
sonar feed --json | jq '.[].tweet.text' | your-summarizer-script

# Stream high-score items to a file
sonar feed --follow --json | jq --unbuffered 'select(.score > 0.7)' >> highlights.jsonl
```

### Monitor the pipeline

Watch the queue in real time while refresh runs:

```bash
sonar refresh
sonar status --watch
```

### Interactive triage

Work through suggestions without leaving the terminal:

```bash
sonar                    # interactive triage is on by default
sonar --no-interactive   # disable for scripting
```

Mark suggestions as skip, later, or archive — keyboard-driven.

### Build your own filters and dashboards (WIP)

Download your data and build your own tools on top of it.

```bash
sonar sync # sync data to ~/.sonar/data.db
```

No lock-in. If you outgrow us, you leave with your data intact.

---

## How Sonar finds relevant content

Sonar surfaces relevant content from your immediate network — the people you follow and who follow you. Your network is already a curated signal layer. Sonar's job is to surface what's moving through that graph before it reaches mainstream feeds.

What this means in practice:

* Results reflect your network's attention, not global virality
* The feed gets more useful the more intentional you are about who you follow
* Bookmarking and liking content improves your recommendations over time
* Topics sharpen what Sonar surfaces within your graph

## Setup

### Prerequisites

* Node.js 20+
* `pnpm`
* A Sonar API key from [sonar.8640p.info](https://sonar.8640p.info/)

### Install and authenticate

```bash
pnpm add -g @1a35e1/sonar-cli@latest

export SONAR_API_KEY="your_api_key_here"
sonar config setup key=<YOUR_API_KEY>
```

Verify it works:

```bash
sonar status
sonar topics
```

---

## Command Reference

### Default — triage suggestions

```bash
sonar                                # interactive triage (default)
sonar --hours 24                     # widen time window
sonar --days 3                       # last 3 days
sonar --kind bookmarks               # default | bookmarks | followers | following
sonar --render table --limit 50      # table layout
sonar --json                         # raw JSON output
sonar --no-interactive               # disable interactive mode
```

### Feed — read-only view

```bash
sonar feed                           # read-only feed (last 12h, limit 20)
sonar feed --hours 48 --limit 50     # widen window
sonar feed --kind bookmarks          # bookmarks | followers | following
sonar feed --render table            # table layout
sonar feed --json | jq .             # pipe to jq
```

#### Streaming with --follow

Poll for new items continuously and stream them to your terminal or another process:

```bash
sonar feed --follow                  # poll every 30s, visual cards
sonar feed --follow --interval 10    # poll every 10s
sonar feed --follow --json           # NDJSON stream (one JSON per line)
sonar feed --follow --json | jq --unbuffered '.score'
```

Press `q` to quit follow mode.

### Topics

```bash
sonar topics                         # list all topics
sonar topics --json                  # JSON output
sonar topics add "AI agents"         # add a topic
sonar topics view <id>               # view a topic
sonar topics edit <id> --name "New Name"
sonar topics delete <id>             # delete a topic
```

#### AI-powered topic suggestions

Let Sonar suggest new topics based on your existing interests and recent feed:

```bash
sonar topics suggest                 # interactive — y/n/q per suggestion
sonar topics suggest --count 3       # limit to 3 suggestions
sonar topics suggest --vendor anthropic  # use Anthropic instead of OpenAI
sonar topics suggest --json          # raw suggestions as JSON
```

Requires `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` depending on vendor.

### Pipeline

```bash
sonar refresh                        # full pipeline: graph → tweets → suggestions
sonar status                         # account status, queue activity
sonar status --watch                 # poll every 2s
```

### Triage

```bash
sonar skip --id <suggestion_id>      # skip a suggestion
sonar later --id <suggestion_id>     # save for later
sonar archive --id <suggestion_id>   # archive a suggestion
```

### Config

```bash
sonar config                         # show current config
sonar config setup key=<API_KEY>     # set API key
```

### Sync

```bash
sonar sync bookmarks                 # sync bookmarks to local SQLite
```

---

## Environment Variables

| Variable            | Required             | Purpose                                                             |
| ------------------- | -------------------- | ------------------------------------------------------------------- |
| `SONAR_API_KEY`     | Yes                  | Auth token from [sonar.8640p.info](https://sonar.8640p.info/)       |
| `SONAR_API_URL`     | No                   | GraphQL endpoint (default: production API)                          |
| `SONAR_MAX_RETRIES` | No                   | Max retry attempts on transient failures (default: 3, 0 to disable) |
| `OPENAI_API_KEY`    | For `topics suggest` | Required when using OpenAI vendor for AI suggestions                |
| `ANTHROPIC_API_KEY` | For `topics suggest` | Required when using Anthropic vendor for AI suggestions             |

## Local Files

| Path                   | Contents                     |
| ---------------------- | ---------------------------- |
| `~/.sonar/config.json` | Token, API URL, CLI defaults |
| `~/.sonar/data.db`     | Local synced SQLite database |

---

## Drift Prevention Checks

```bash
# Run all drift checks (surface/docs/data/schema)
pnpm drift:check

# Refresh committed command snapshot after intentional command changes
pnpm drift:surface:update
```

`drift:schema:check` validates GraphQL documents against the live schema.
Locally, it skips when offline; in CI (`CI=true`) it is enforced.

---

## Troubleshooting

**`No token found. Set SONAR_API_KEY or run: sonar config setup`**
Set `SONAR_API_KEY` in your environment or run `sonar config setup key=<YOUR_KEY>`.

**`Unable to reach server, please try again shortly.`**
Check your network connection and API availability. The CLI automatically retries transient failures (network errors, 5xx) up to 3 times with exponential backoff. Use `--debug` to see retry attempts. Set `SONAR_MAX_RETRIES=0` to disable retries.
