# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
