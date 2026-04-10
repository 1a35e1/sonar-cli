# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] - 2026-04-10

### Added

- **feat: data export** — `sonar data export --format json --window 1d` for bulk suggestion/bookmark/like export with cursor pagination.
- **feat: X API rate limit handling** — detect 429s explicitly with retry guidance.

### Changed

- **refactor: migrate CLI from Pastel to Commander + Ink** — faster startup, better arg parsing, composable subcommands.
- **refactor: extract parseWindow to lib/time** — shared time window parsing across commands.
- **refactor: add analysis helpers to lib/ai** — structured OpenAI/Anthropic analysis calls for upcoming lens commands.

### Fixed

- **fix: use structured outputs for LLM response parsing** — replaces fragile regex with JSON schema validation.
- **fix: client-side input validation** — topic names and descriptions validated before API call.

## [0.4.0] - 2026-04-08

### Added

- **`sonar account` — multi-account management** — `add`, `switch`, `remove`, `rename` commands with `~/.sonar/accounts.json`. Random fun names (bouncy-rabbit) for unnamed accounts.
- **`sonar refresh` composable flags** — `--bookmarks`, `--likes`, `--graph`, `--tweets`, `--suggestions` for selective pipeline execution. Any combo works.
- **`sonar sync likes`** — sync likes from X (mirrors `sync bookmarks`).
- **`sonar data` namespace** — `pull`, `backup`, `restore`, `verify`, `path`, `sql` moved from `config data`.
- **Help banner** — spaced `S O N A R` header with version on `--help`.
- **Account rename** — `sonar account rename <old> <new>` with hint on random names.

### Changed

- **WASM SQLite** — replaced `better-sqlite3` (native) with `node-sqlite3-wasm`. No more Node version mismatch errors, works on any platform.
- **`SONAR_API_KEY` removed** — auth is now exclusively via `sonar account add <key>`. Existing `config.json` tokens auto-migrate.
- **`config data` → `data`** — flatter namespace. `download`/`sync` merged into `sonar data pull`.
- **`interests` → `topics`** — consistent naming in local SQLite schema.
- **Pulse spinner** — switched to `unicode-animations` pulse spinner.

### Fixed

- **Pipeline auth errors** — detect expired X OAuth, show re-auth guidance, surface backend error messages.
- **Pipeline error visibility** — backend now exposes error field in status endpoint, stale errors cleared on new runs.

## [0.3.1] - 2026-04-08

### Added

- **feat: `sonar feed` command** — Read-only feed view with `--hours`, `--days`, `--limit`, `--kind`, `--render`, `--width`, `--json` flags. No triage, pure pipe-friendly output.
- **feat: `sonar feed --follow`** — Continuous polling mode with NDJSON streaming (`--follow --json`), configurable interval (`--interval`), and xid-based deduplication.
- **feat: `sonar topics suggest`** — AI-powered topic suggestions using OpenAI or Anthropic. Interactive accept/reject UI with `--count`, `--vendor`, and `--json` flags.
- **feat: GraphQL client retry with exponential backoff** — Automatic retries on network errors and 5xx with jittered backoff. Configurable via `SONAR_MAX_RETRIES` env var.
- **feat: trusted publishing via GitHub Actions** — `publish.yml` workflow triggers on GitHub release, publishes with OIDC provenance. No OTP required.
- **feat: `sonar topics view`, `topics delete`** — Full topic CRUD from the CLI.
- **feat: `sonar sync bookmarks`** — Sync bookmarks from X.
- **feat: `status --watch` improvements** — Press `r` to refresh, `q` to quit, pipeline step progress, deferred job counts.
- **feat: drift prevention checks** — CI gate for schema, surface, docs, and data compatibility drift.

### Fixed

- **fix: config nuke deletes real local database** — Previously left orphaned DB file.
- **fix: align CLI queries with current topics schema** — Renamed `interests` → `topics` throughout.
- **fix: suppress spinner in `--json` mode** — Clean JSON output safe to pipe.
- **fix: unknown command shows error** — Instead of falling through silently.

### Changed

- **chore: renamed `release` skill to `release-cli`** — Clearer naming, switched to trusted publishing pipeline.
- **refactor: `interests` → `topics` rename** — Consistent naming across CLI commands, queries, and user-facing strings.

## [0.2.1] - 2026-03-04

### Added

- **feat: add `sonar quickstart` command** — New quick-start command for first-time setup (#7).

### Fixed

- **fix: correct CLI command from 'sonar ingest monitor' to 'sonar monitor'** — Fixed incorrect command reference in documentation/output (#9).

### Changed

- **chore: added release skill** — Added automated release workflow skill.

## [0.2.0] - 2026-02-23

### Added

- **feat: add sonar quickstart command** — New `sonar quickstart` command for first-time setup. Checks authentication, proposes 3 starter interests tailored to the typical Sonar user, creates them on confirmation, triggers tweet indexing, and shows an initial inbox preview — all in one step.

- **feat(config data): add sqlite backup/restore/verify commands** — New `sonar config data backup`, `config data restore`, and `config data verify` commands for managing the local SQLite database. Useful for safeguarding your data before migrations or upgrades.

### Fixed

- **fix: suppress spinner output in --json mode for interests create/update** — Running `interests create` or `interests update` with `--json` no longer leaks spinner/progress text into the JSON output, making it safe to pipe to `jq` and other tools.

- **fix: ingest hang diagnostics — timeout detection + actionable error output** — `ingest` commands that stall due to upstream API delays now detect the hang, surface a clear timeout error with guidance, and exit cleanly instead of hanging indefinitely.

- **fix: --from-prompt timeout handling with actionable error output** — When using `--from-prompt` and the AI step times out, sonar-cli now reports the timeout with an actionable message rather than crashing silently.

- **fix: actionable diagnostics for empty feed/inbox results** — When `feed` or `inbox` returns no results, sonar-cli now explains why (e.g. no interests configured, no items ingested) and suggests next steps instead of printing an unhelpful empty list.

## [0.1.3] - prior

See git history for earlier changes.
