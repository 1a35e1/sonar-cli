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

View your account to ensure evrything works.

```sh
sonar account
```

Ingest your first `tweets` and check to `monitor` progress.

> The first time this you run this command it will take some time.

```sh
sonar ingest tweets

sonar monitor
sonar monitor --watch
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

We believe your data is yours. So you want to go deeper than our platform allows — build your own models, run custom queries, pipe it into your own tooling — you can download everything we have indexed on your behalf into a local SQLite database and do whatever you want with it:

```bash
pnpm run cli -- data download   # full snapshot → ~/.sonar/data.db
pnpm run cli -- data sync       # incremental updates
pnpm run cli -- data sql        # drop into a sqlite3 shell
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
pnpm run cli -- feed --hours 8 --render card
pnpm run cli -- inbox --status inbox
```

### Track a topic you care about — right now

Create a new interest from a plain English prompt and get content immediately:

```bash
pnpm run cli -- interests create \
  --from-prompt "I want to follow AI evals and agent infrastructure"

pnpm run cli -- index suggestions --days 1
pnpm run cli -- feed --hours 24
```

Sonar generates keywords and topics from your prompt, kicks off indexing, and your feed updates with relevant posts.

### Build a scriptable news digest

Combine `--json` output with `jq` to pipe Sonar content wherever you want:

```bash
# Get today's top feed items as JSON
pnpm run cli -- feed --hours 24 --json | jq '.[] | {author, text, url}'

# Summarize your inbox with an LLM
pnpm run cli -- inbox --json | jq '.[].text' | your-summarizer-script
```

### Keep your local data fresh and queryable

Download a full SQLite snapshot of your Sonar data and query it directly:

```bash
pnpm run cli -- data download
pnpm run cli -- data sql
# Now you have a full sqlite3 shell — write any query you want
```

Run incremental syncs on a cron to keep it current:

```bash
# crontab: sync every 30 minutes
*/30 * * * * cd /your/project && pnpm run cli -- data sync
```

### Interactive triage

Work through your inbox without leaving the terminal:

```bash
pnpm run cli -- inbox --interactive
pnpm run cli -- feed --interactive
```

Mark suggestions as read, skip, archive, or save for later — keyboard-driven.

### Monitor indexing jobs

Watch the queue in real time while you trigger a full re-index:

```bash
pnpm run cli -- index          # trigger all jobs
pnpm run cli -- index status --watch   # watch until complete
```

---

## What Sonar doesn't do

Sonar is **not a global search engine**. It won't crawl the entire internet or index trending posts from people you've never heard of.

Instead, it searches within your social graph — your followers and the people you follow — up to **2 degrees of separation**. That's it. This is an intentional constraint, not a limitation we're working around.

The reason is practical: API rate limits make broad crawling impossible at any useful refresh frequency. But the reason it works is more interesting — **the people in your network are already a curated signal layer**. The accounts you follow, and the accounts they follow, are a surprisingly high-quality filter for what's relevant to your domain. Sonar's job is to surface what's moving through that graph before it reaches mainstream feeds.

What this means in practice:

* Results reflect your network's attention, not global virality
* You won't see noise from accounts you have no connection to
* The feed gets more useful the more intentional you are about who you follow
* Adding interests with specific keywords and topics sharpens what Sonar surfaces *within* that graph

If you want global trend monitoring, tools like Brandwatch or Twitter's native search are better fits. Sonar is for developers who want a focused, low-noise signal from a network they've already curated.

---

## Pair with OpenClaw

[OpenClaw](https://github.com/openclaw/openclaw) is a local-first autonomous AI agent that runs on your machine and talks to you through WhatsApp, Telegram, Discord, Slack, or iMessage. It can execute shell commands, run on a schedule, and be extended with custom skills.

Sonar + OpenClaw is a natural stack: **Sonar handles the signal filtering and curation, OpenClaw handles delivery and action.** Together they turn your social feed into an ambient intelligence layer you don't have to babysit.

### Morning briefing delivered to your phone

Set up a cron job in OpenClaw to run your Sonar digest and pipe it back to you on Telegram every morning:

```
# In OpenClaw: schedule a daily 8am briefing
"Every morning at 8am, run `sonar feed --hours 8 --json` and summarize the top 5 posts for me"
```

OpenClaw will execute the CLI, pass the JSON output to your LLM, and send a clean summary straight to your phone — no dashboard to open.

### Ask your feed questions in natural language

Because `--json` makes Sonar output composable, OpenClaw can reason over it conversationally:

```
# Example prompts you can send OpenClaw via WhatsApp:
"What's the most discussed topic in my Sonar feed today?"
"Did anyone in my feed mention Uniswap V4 in the last 48 hours?"
"Summarize my unread Sonar inbox"
```

Wire it up once as an OpenClaw skill and your feed becomes queryable from any messaging app.

### Triage your inbox hands-free

Combine OpenClaw's scheduling with Sonar's inbox API to automatically mark low-signal suggestions:

```bash
# Shell script you can hand to OpenClaw as a scheduled skill
sonar inbox --json | \
  jq '[.[] | select(.score < 0.4) | .id]' | \
  xargs -I{} sonar inbox skip {}
```

Run this nightly and your inbox stays clean without manual triage.

### Get alerted when a topic spikes

Use OpenClaw's Heartbeat (scheduled wake-up) to watch for signal surges and notify you:

```
# OpenClaw cron: check every 2 hours
"Run `sonar feed --hours 2 --json` — if there are more than 10 posts about
'token launchpad' or 'LVR', send me a Telegram alert with the highlights"
```

Effectively a custom Google Alert, but filtered through your actual interest graph.

### Build a Sonar skill for OpenClaw

The cleanest integration is wrapping Sonar as a reusable OpenClaw skill. Drop a skill file in your OpenClaw workspace:

```typescript
// skills/sonar.ts
export async function getFeed(hours = 12) {
  const { stdout } = await exec(`sonar feed --hours ${hours} --json`);
  return JSON.parse(stdout);
}

export async function getInbox() {
  const { stdout } = await exec(`sonar inbox --json`);
  return JSON.parse(stdout);
}
```

Once registered, OpenClaw can call these tools autonomously whenever it decides they're relevant — no manual prompting required.

---

## Setup

### Prerequisites

* Node.js 20+
* `pnpm`
* A Sonar API key from [sonar.sh/account](https://sonar.sh/account?tab=api-keys)
* Optional: `sqlite3` CLI (only needed for `data sql`)

### Install and authenticate

```bash
pnpm install

export SONAR_API_KEY="your_api_key_here"
pnpm run cli -- init
```

`init` writes your config to `~/.sonar/config.json`. If `SONAR_API_KEY` is set in your environment, it always takes precedence.

Verify it works:

```bash
pnpm run cli -- account
pnpm run cli -- interests
```

---

## Command Reference

### Account & Config

```bash
pnpm run cli -- account              # plan, usage, suggestion counters
pnpm run cli -- config               # show current config
pnpm run cli -- config set vendor anthropic      # or openai
pnpm run cli -- config set feed-render card      # or table
pnpm run cli -- config set feed-width 100
```

### Interests

```bash
pnpm run cli -- interests                          # list all
pnpm run cli -- interests --json                   # JSON output

# Create manually
pnpm run cli -- interests create \
  --name "Rust Systems" \
  --description "Rust, compilers, and systems tooling" \
  --keywords "rust,cargo,wasm" \
  --topics "systems programming,performance"

# Create from a natural language prompt (requires OPENAI_API_KEY or ANTHROPIC_API_KEY)
pnpm run cli -- interests create \
  --from-prompt "I want to follow AI evals and agent infra"

# Update
pnpm run cli -- interests update --id <id> --name "New Name"
pnpm run cli -- interests update --id <id> --add-keywords "mcp,langgraph"
pnpm run cli -- interests update --id <id> --remove-topics "old-topic"
```

### Feed

```bash
pnpm run cli -- feed                          # last 12h, limit 20, card render
pnpm run cli -- feed --hours 24
pnpm run cli -- feed --days 3
pnpm run cli -- feed --kind bookmarks         # default | bookmarks | followers | following
pnpm run cli -- feed --render table --limit 50
pnpm run cli -- feed --interactive
pnpm run cli -- feed --json
```

### Inbox

```bash
pnpm run cli -- inbox                         # list inbox suggestions
pnpm run cli -- inbox --all
pnpm run cli -- inbox --status inbox --limit 50
pnpm run cli -- inbox --interactive
pnpm run cli -- inbox --json

pnpm run cli -- inbox read --id <suggestion_id>
pnpm run cli -- inbox skip --id <suggestion_id>
pnpm run cli -- inbox later --id <suggestion_id>
pnpm run cli -- inbox archive --id <suggestion_id>
```

### Indexing

```bash
pnpm run cli -- reindex                       # run all jobs
pnpm run cli -- reindex tweets
pnpm run cli -- reindex graph
pnpm run cli -- reindex graph --force
pnpm run cli -- reindex suggestions --days 1
pnpm run cli -- reindex bookmarks
pnpm run cli -- reindex status
pnpm run cli -- reindex status --watch
```

### Local Data

```bash
pnpm run cli -- data download     # full download → ~/.sonar/data.db
pnpm run cli -- data sync         # incremental sync
pnpm run cli -- data path         # print DB path
pnpm run cli -- data sql          # open sqlite3 shell
```

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `SONAR_API_KEY` | Yes (unless saved by `init`) | Auth token |
| `SONAR_API_URL` | No | GraphQL endpoint (default: `http://localhost:8000/graphql`) |
| `SONAR_AI_VENDOR` | No | AI vendor for prompt generation (`openai` or `anthropic`) |
| `SONAR_FEED_RENDER` | No | Default render style (`card` or `table`) |
| `SONAR_FEED_WIDTH` | No | Default card width |
| `OPENAI_API_KEY` | Sometimes | Required for OpenAI-powered `--from-prompt` |
| `ANTHROPIC_API_KEY` | Sometimes | Required for Anthropic-powered `--from-prompt` |

## Local Files

| Path | Contents |
|---|---|
| `~/.sonar/config.json` | Token, API URL, CLI defaults |
| `~/.sonar/data.db` | Local synced SQLite database |

---

## Troubleshooting

**`No token found. Set SONAR_API_KEY or run: sonar init`**
Set `SONAR_API_KEY` in your environment, then run `pnpm run cli -- init`.

**`Unable to reach server, please try again shortly.`**
Check `SONAR_API_URL`, your network, and API availability.

**`OPENAI_API_KEY is not set` / `ANTHROPIC_API_KEY is not set`**
Set the key for your chosen vendor before using `--from-prompt` or interactive reply generation.
