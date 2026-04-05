# CLI Redesign — tasks/todo.md

## Goal

Redesign the Sonar CLI surface from a pipeline-centric model to an interest-monitoring model. Users should be able to surface their interests and understand status without thinking about ingestion, matching, or inbox vs feed distinctions.

## Branch

`feat/cli-redesign`

## Stack

No framework change — keeping Pastel + Ink. The redesign is purely command surface and UX.

## Legacy

Old commands preserved in `src/commands-legacy/` for reference during migration. New commands go in `src/commands/`.

---

## New command surface

| Command | Replaces | Notes |
|---|---|---|
| `sonar` | `feed` + `inbox` | Combined default view, sorted by relevance |
| `sonar interests` | `interests` (list) | List tracked interests |
| `sonar interests add "..."` | `interests create --from-prompt` | Natural language add |
| `sonar interests edit <name>` | `interests update` | Edit an interest |
| `sonar refresh` | `ingest tweets` + `ingest bookmarks` + `interests match` | Force pipeline refresh, single escape hatch |
| `sonar status [--watch]` | `monitor` + `account` | Pipeline health + account in one view |
| `sonar archive <id>` | `inbox archive` | Triage action |
| `sonar later <id>` | `inbox later` | Triage action |
| `sonar skip <id>` | `inbox skip` | Triage action |
| `sonar config` | `config` | Unchanged |

**Retired (no replacement needed):**
- `quickstart` → auto-trigger on first run if no interests exist
- `ingest` → internal, surfaced via `sonar refresh`
- `interests match` → internal, part of `sonar refresh`
- `feed --kind` → bookmarks become a filter on `sonar --kind bookmarks`

---

## Tasks

### Phase 1 — Scaffold

- [ ] Create `src/commands/index.tsx` — new default view (combined feed + inbox)
- [ ] Create `src/commands/interests/index.tsx` — list interests
- [ ] Create `src/commands/interests/add.tsx` — add interest from natural language
- [ ] Create `src/commands/interests/edit.tsx` — edit interest
- [ ] Create `src/commands/refresh.tsx` — trigger ingest + match
- [ ] Create `src/commands/status.tsx` — combined monitor + account
- [ ] Create `src/commands/archive.tsx` — triage: archive
- [ ] Create `src/commands/later.tsx` — triage: later
- [ ] Create `src/commands/skip.tsx` — triage: skip
- [ ] Keep `src/commands/config/` — copy from legacy unchanged

### Phase 2 — Default view (`sonar`)

- [ ] Merge feed + inbox into single ranked list
- [ ] Support `--kind` filter (default|bookmarks|followers|following)
- [ ] Support `--hours` / `--days` window
- [ ] Support `--limit`
- [ ] Support `--interactive` (AI exploration)
- [ ] Support `--json`
- [ ] First-run: if no interests exist, prompt to run `sonar interests add` or scaffold defaults

### Phase 3 — Interests

- [ ] `sonar interests` — table of interests with keyword/topic summary
- [ ] `sonar interests add "..."` — natural language → create interest (wrap existing AI flow)
- [ ] `sonar interests edit <name>` — interactive or flag-based edit (wrap existing update flow)

### Phase 4 — Status + Refresh

- [ ] `sonar status` — account card + queue table in one view (port from monitor + account)
- [ ] `sonar status --watch` — live polling
- [ ] `sonar refresh` — trigger ingest tweets + bookmarks + interests match sequentially, show progress

### Phase 5 — Triage actions

- [ ] `sonar archive <id>`
- [ ] `sonar later <id>`
- [ ] `sonar skip <id>`

### Phase 6 — Cleanup

- [ ] Remove `src/commands-legacy/` once all commands are migrated and verified
- [ ] Update README command reference
- [ ] Update `config skill` generated skill file to reflect new surface
- [ ] Run `/sonar fix-cli sonar` on each new command to verify clean

---

## Review

_To be filled in after implementation._
