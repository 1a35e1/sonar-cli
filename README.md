# 🔊 Sonar (Preview)

Experimental X CLI for OpenClaw 🦞 power users.

Sonar matches interests from your X graph using various AI pipelines. We built this to automate our social intelligence.

This cli has been designed to handover indexing and consumption to agents.

* Pipe it into scripts,
* automate your morning briefing,
* Or just discover tweets you probably missed out on the web interface.

---

## Get started

* Register with `X` to get an API key from `https://sonar.8640p.info/`
  * Learn more about which [scopes](#scopes) we request and why.

Install the CLI

```sh
pnpm add -g @1a35e1/sonar-cli@latest
```

Register your API key.

```sh
# Make "SONAR_API_KEY" avaliable in your env
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

* We currently request `read:*` and `offline:processing` scopes based on <<https://docs.x.com/fundamentals/authentication/oauth-2-0/>. If there is an appite

* So we can stay connected to your account until you revoke access.
* Posts you’ve liked and likes you can view.
* All the posts you can view, including posts from protected accounts.
* Accounts you’ve muted.
* Accounts you’ve blocked.
* People who follow you and people who you follow.
* All your Bookmarks.
* Lists, list members, and list followers of lists you’ve created or are a member of, including private lists.
* Any account you can view, including protected accounts.

## Why Sonar exists

Setting up your own social data pipeline is genuinely awful. You're looking at OAuth flows, rate limit math, pagination handling, webhook plumbing, deduplication logic, and a SQLite schema you'll regret in three weeks — before you've seen a single useful result. Most developers who try it abandon it halfway through.

**Sonar skips all of that. Get actionalable data for OpenClaw in 15 minutes.**

We believe your data is yours. If you want to go deeper than our platform allows — build your own models, run custom queries, pipe it into your own tooling — you can sync everything we have indexed on your behalf into a local SQLite database:

```bash
sonar sync              # sync data to ~/.sonar/data.db
```

No lock-in. If you outgrow us, you leave with your data intact.

## Design philosophy

There's a quiet shift happening in how developer tools are built.

In the early web2 era, API-first was a revelation. Stripe, Twilio, Sendgrid — companies that exposed clean REST contracts unlocked entire ecosystems of products built on top of them. The insight was simple: if your service has strong, reliable APIs, anyone can build anything. The interface didn't matter as much as the contract underneath.
We're at a similar inflection point now, but the interface layer has changed dramatically.

The goal for most workflows today is fire and forget — you define what you want, set it in motion, and let agents handle the execution. That only works if the underlying APIs are strong enough to support complex, long-running ETL pipelines without hand-holding. Sonar is built with that assumption: the API is the product, the CLI is just one interface into it.
Which raises an interesting question about CLIs themselves. Traditionally a CLI was developer-first by definition — you were writing for someone comfortable with flags, pipes, and man pages. But if the primary consumer of your CLI is increasingly an agent (OpenClaw, a cron job, an LLM with tool access), the design principles shift:

Output should be machine-readable by default. Every command has a --json flag. Agents don't parse card renders.
Commands should be composable. Small, single-purpose commands that pipe cleanly into each other are more useful to an agent than monolithic workflows.

Side effects should be explicit. An agent calling index --force should know exactly what it's triggering. No surprises.
Errors should be structured. A human reads an error message. An agent needs to know whether to retry, skip, or escalate.

The CLI still needs to work well for humans — interactive mode, card renders, readable output — but those are progressive enhancements on top of a foundation built for automation. Design for the agent, polish for the human.
This is what API-first looks like in the agentic era: strong contracts at the service layer, composable interfaces at the CLI layer, and a clear separation between the two.

---

## What you can do with it

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

---

## How Sonar finds signal

Sonar surfaces relevant content from your X social graph — the people you follow and who follow you. Your network is already a curated signal layer. Sonar's job is to surface what's moving through that graph before it reaches mainstream feeds.

What this means in practice:

* Results reflect your network's attention, not global virality
* The feed gets more useful the more intentional you are about who you follow
* Bookmarking and liking content improves your recommendations over time
* Topics sharpen what Sonar surfaces within your graph

---

## Pair with OpenClaw

[OpenClaw](https://github.com/openclaw/openclaw) is a local-first autonomous AI agent that runs on your machine and talks to you through WhatsApp, Telegram, Discord, Slack, or iMessage. It can execute shell commands, run on a schedule, and be extended with custom skills.

Sonar + OpenClaw is a natural stack: **Sonar handles the signal filtering and curation, OpenClaw handles delivery and action.** Together they turn your social feed into an ambient intelligence layer you don't have to babysit.

### Morning briefing delivered to your phone

Set up a cron job in OpenClaw to run your Sonar digest every morning:

```
# In OpenClaw: schedule a daily 8am briefing
"Every morning at 8am, run `sonar --hours 8 --json` and summarize the top 5 posts for me"
```

OpenClaw will execute the CLI, pass the JSON output to your LLM, and send a clean summary straight to your phone.

### Ask your feed questions in natural language

Because `--json` makes Sonar output composable, OpenClaw can reason over it:

```
# Example prompts you can send OpenClaw via WhatsApp:
"What's the most discussed topic in my Sonar feed today?"
"Did anyone in my feed mention Uniswap V4 in the last 48 hours?"
"Summarize my Sonar suggestions"
```

### Get alerted when a topic spikes

Use OpenClaw's Heartbeat to watch for signal surges:

```
# OpenClaw cron: check every 2 hours
"Run `sonar --hours 2 --json` — if there are more than 10 posts about
'token launchpad' or 'LVR', send me a Telegram alert with the highlights"
```

### Build a Sonar skill for OpenClaw

Wrap Sonar as a reusable OpenClaw skill:

```typescript
// skills/sonar.ts
export async function getSuggestions(hours = 12) {
  const { stdout } = await exec(`sonar --hours ${hours} --json`);
  return JSON.parse(stdout);
}

export async function getStatus() {
  const { stdout } = await exec(`sonar status --json`);
  return JSON.parse(stdout);
}
```

Once registered, OpenClaw can call these tools autonomously whenever it decides they're relevant.

---

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
sonar topics edit --id <id> --name "New Name"
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
sonar archive                        # archive old suggestions
```

### Config

```bash
sonar config                         # show current config
sonar config setup key=<API_KEY>     # set API key
```

### Local Data

```bash
sonar sync                           # sync data to local SQLite
```

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `SONAR_API_KEY` | Yes | Auth token from [sonar.8640p.info](https://sonar.8640p.info/) |
| `SONAR_API_URL` | No | GraphQL endpoint (default: production API) |
| `SONAR_MAX_RETRIES` | No | Max retry attempts on transient failures (default: 3, 0 to disable) |
| `OPENAI_API_KEY` | For `topics suggest` | Required when using OpenAI vendor for AI suggestions |
| `ANTHROPIC_API_KEY` | For `topics suggest` | Required when using Anthropic vendor for AI suggestions |

## Local Files

| Path | Contents |
|---|---|
| `~/.sonar/config.json` | Token, API URL, CLI defaults |
| `~/.sonar/data.db` | Local synced SQLite database |

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
