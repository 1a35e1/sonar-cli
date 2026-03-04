---
name: release
description: Run the full npm release workflow — version bump, changelog, build, publish, push, and GitHub release.
user-invocable: true
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
argument-hint: <patch|minor|major>
---

# Release Workflow

Execute the full release pipeline for `@1a35e1/sonar-cli`. The user invokes this skill with a semver bump type: `patch`, `minor`, or `major`.

## Argument Validation

The argument MUST be one of: `patch`, `minor`, or `major`. If missing or invalid, print usage and stop:

```
Usage: /release <patch|minor|major>
```

## Step 1: Pre-flight Checks

Run these checks sequentially. Abort on the first failure with a clear message.

1. **Clean working tree**: Run `git status --porcelain`. If output is non-empty, abort: "Working tree is not clean. Commit or stash changes first."
2. **On main branch**: Run `git branch --show-current`. If not `main`, abort: "Must be on the main branch to release."
3. **Typecheck passes**: Run `pnpm build` (this runs `tsc`). If it fails, abort: "Build failed. Fix type errors before releasing."

## Step 2: Version Bump

1. Run `pnpm version <BUMP_TYPE> --no-git-tag-version` to bump the version in `package.json`.
2. Read `package.json` and extract the new `"version"` field. Store it as `NEW_VERSION` for use in later steps.
3. Print: "Version bumped to NEW_VERSION"

## Step 3: Update CHANGELOG

1. Collect commits since the last release. Run:
   ```
   git log --oneline $(git log --all --grep='chore: release' --format='%H' -1)..HEAD
   ```
   If no release commit is found, collect all commits with `git log --oneline`.

2. Generate a new changelog section following the existing Keep a Changelog format. Use today's date (YYYY-MM-DD). Categorize commits under `### Added`, `### Fixed`, `### Changed`, etc. based on conventional commit prefixes (`feat:` -> Added, `fix:` -> Fixed, `chore:`/`refactor:` -> Changed). Omit empty categories. Each entry should be a bullet starting with the commit message in bold, with a short description if the message is clear enough.

3. Insert the new section into `CHANGELOG.md` immediately after the header block (the `# Changelog` line and the two description lines). The new section goes BEFORE any existing `## [x.y.z]` sections.

   Example format:
   ```markdown
   ## [0.3.0] - 2026-03-04

   ### Added

   - **feat: add foo command** — Description of the change.

   ### Fixed

   - **fix: bar edge case** — Description of the fix.
   ```

4. Print the generated changelog section for the user to review.

## Step 4: Build

Run `pnpm build` to compile TypeScript to `dist/`. Abort if this fails.

## Step 5: Git Commit

1. Stage exactly these files: `package.json`, `pnpm-lock.yaml`, `CHANGELOG.md`
2. Commit with message: `chore: release NEW_VERSION`
3. Print: "Committed: chore: release NEW_VERSION"

## Step 6: npm Publish (Confirmation Gate)

**ASK THE USER FOR CONFIRMATION AND COLLECT OTP** before proceeding:

> Ready to publish `@1a35e1/sonar-cli@NEW_VERSION` to npm. Provide your npm OTP to proceed (or "skip" to stop).

If the user provides an OTP:
1. Run `pnpm publish --access public --otp <OTP>`
2. Confirm success. If it fails, abort with the error output.

If the user says "skip" or denies, stop the workflow here.

## Step 7: Push + GitHub Release (Confirmation Gate)

**ASK THE USER FOR CONFIRMATION** before proceeding:

> Ready to push to remote and create GitHub release v{NEW_VERSION}. Proceed?

If confirmed:
1. Run `git push`
2. Create a GitHub release using the changelog section from Step 3:
   ```
   gh release create v<NEW_VERSION> --title "v<NEW_VERSION>" --notes "<changelog section from step 3>"
   ```
3. Print the GitHub release URL from the `gh` output.

If denied, remind the user they can push and create the release manually later.

## Error Handling

- If any command fails, print the full error output and abort immediately.
- Do NOT continue past a failed step — each step depends on the previous one.
- If publish fails, the commit is already made locally. Inform the user they can retry with `pnpm publish --access public` after fixing the issue.
