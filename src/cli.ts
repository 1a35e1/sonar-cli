#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Command } from 'commander'
import { render } from 'ink'
import React from 'react'

// ── Package metadata ────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))

const HEADER = `
     S O N A R
     ────────────────────────
     ${pkg.version}
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function run(Cmd: React.ComponentType<any>, props?: Record<string, unknown>) {
  render(React.createElement(Cmd, props))
}

// ── Imports ─────────────────────────────────────────────────────────
import IndexCmd from './commands/index.js'
import FeedCmd from './commands/feed.js'
import RefreshCmd from './commands/refresh.js'
import StatusCmd from './commands/status.js'
import ArchiveCmd from './commands/archive.js'
import SkipCmd from './commands/skip.js'
import LaterCmd from './commands/later.js'

import AccountListCmd from './commands/account/index.js'
import AccountAddCmd from './commands/account/add.js'
import AccountSwitchCmd from './commands/account/switch.js'
import AccountRenameCmd from './commands/account/rename.js'
import AccountRemoveCmd from './commands/account/remove.js'

import ConfigShowCmd from './commands/config/index.js'
import ConfigSetupCmd from './commands/config/setup.js'
import ConfigSetCmd from './commands/config/set.js'
import ConfigEnvCmd from './commands/config/env.js'
import ConfigNukeCmd from './commands/config/nuke.js'
import ConfigSkillCmd from './commands/config/skill.js'

import DataPullCmd from './commands/data/pull.js'
import DataPathCmd from './commands/data/path.js'
import DataBackupCmd from './commands/data/backup.js'
import DataRestoreCmd from './commands/data/restore.js'
import DataExportCmd from './commands/data/export.js'
import DataSqlCmd from './commands/data/sql.js'
import DataVerifyCmd from './commands/data/verify.js'

import TopicsListCmd from './commands/topics/index.js'
import TopicsAddCmd from './commands/topics/add.js'
import TopicsEditCmd from './commands/topics/edit.js'
import TopicsDeleteCmd from './commands/topics/delete.js'
import TopicsSuggestCmd from './commands/topics/suggest.js'
import TopicsViewCmd from './commands/topics/view.js'

import LensEmergingCmd from './commands/lens/emerging.js'
import LensDiffCmd from './commands/lens/diff.js'
import LensExpertsCmd from './commands/lens/experts.js'
import LensContrarianCmd from './commands/lens/contrarian.js'
import LensBlindspotCmd from './commands/lens/blindspots.js'

// ── Program ─────────────────────────────────────────────────────────
const program = new Command('sonar')
  .version(pkg.version, '-v, --version')
  .addHelpText('before', HEADER)

// ── sonar (default — inbox triage) ──────────────────────────────────
program
  .option('--hours <n>', 'Look back N hours (default: 12)', Number)
  .option('--days <n>', 'Look back N days', Number)
  .option('--limit <n>', 'Result limit (default: 20)', Number)
  .option('--kind <value>', 'Feed source: default|bookmarks|followers|following')
  .option('--render <value>', 'Output layout: card|table')
  .option('--width <n>', 'Card width in columns', Number)
  .option('--json', 'Raw JSON output', false)
  .option('--no-interactive', 'Disable interactive mode')
  .option('--vendor <value>', 'AI vendor: openai|anthropic')
  .action((opts, cmd: Command) => {
    if (cmd.args.length > 0) {
      process.stderr.write(`error: unknown command '${cmd.args[0]}'\n`)
      process.stderr.write(`(run 'sonar --help' for available commands)\n`)
      process.exit(1)
    }
    run(IndexCmd, { options: opts })
  })

// ── sonar feed ──────────────────────────────────────────────────────
const feed = program.command('feed').description('Browse your feed')
feed
  .option('--hours <n>', 'Look back N hours (default: 12)', Number)
  .option('--days <n>', 'Look back N days', Number)
  .option('--limit <n>', 'Result limit (default: 20)', Number)
  .option('--offset <n>', 'Skip first N results (default: 0)', Number)
  .option('--kind <value>', 'Feed source: default|bookmarks|followers|following')
  .option('--render <value>', 'Output layout: card|table')
  .option('--width <n>', 'Card width in columns', Number)
  .option('--json', 'Raw JSON output', false)
  .option('--follow', 'Continuously poll for new items', false)
  .option('--interval <n>', 'Poll interval in seconds (default: 30)', Number)
  .action((opts) => { run(FeedCmd, { options: opts }) })

// ── sonar refresh ───────────────────────────────────────────────────
const refresh = program.command('refresh').description('Trigger pipeline refresh')
refresh
  .option('--bookmarks', 'Sync bookmarks from X', false)
  .option('--likes', 'Sync likes from X', false)
  .option('--graph', 'Rebuild social graph', false)
  .option('--tweets', 'Index tweets across network', false)
  .option('--suggestions', 'Regenerate suggestions', false)
  .option('--wait', 'Auto-retry after rate limit resets', false)
  .action((opts) => { run(RefreshCmd, { options: opts }) })

// ── sonar status ────────────────────────────────────────────────────
const status = program.command('status').description('Show pipeline status')
status
  .option('--watch', 'Poll and refresh every 2 seconds', false)
  .option('--json', 'Raw JSON output', false)
  .option('--wait', 'Auto-retry after rate limit resets', false)
  .action((opts) => { run(StatusCmd, { options: opts }) })

// ── sonar archive / skip / later ────────────────────────────────────
program.command('archive').description('Archive a suggestion')
  .requiredOption('--id <value>', 'Suggestion ID to archive')
  .action((opts) => { run(ArchiveCmd, { options: opts }) })

program.command('skip').description('Skip a suggestion')
  .requiredOption('--id <value>', 'Suggestion ID to skip')
  .action((opts) => { run(SkipCmd, { options: opts }) })

program.command('later').description('Save a suggestion for later')
  .requiredOption('--id <value>', 'Suggestion ID to save for later')
  .action((opts) => { run(LaterCmd, { options: opts }) })

// ── sonar account ───────────────────────────────────────────────────
const account = program.command('account').description('Manage accounts')
account
  .option('--json', 'Raw JSON output', false)
  .action((opts) => { run(AccountListCmd, { options: opts }) })

account.command('add').description('Add an account')
  .argument('<key>', 'API key (snr_...)')
  .option('--alias <value>', 'Account alias (default: random)')
  .option('--api-url <value>', 'Custom API URL')
  .action((key: string, opts) => { run(AccountAddCmd, { args: [key], options: opts }) })

account.command('switch').description('Switch active account')
  .argument('<name>', 'Account name to switch to')
  .action((name: string) => { run(AccountSwitchCmd, { args: [name] }) })

account.command('rename').description('Rename an account')
  .argument('<old>', 'Current account name')
  .argument('<new>', 'New account name')
  .action((old: string, name: string) => { run(AccountRenameCmd, { args: [old, name] }) })

account.command('remove').description('Remove an account')
  .argument('<name>', 'Account name to remove')
  .option('--force', 'Remove even if active', false)
  .action((name: string, opts) => { run(AccountRemoveCmd, { args: [name], options: opts }) })

// ── sonar config ────────────────────────────────────────────────────
const config = program.command('config').description('View and manage configuration')
config.action(() => { run(ConfigShowCmd) })

config.command('setup').description('Initial setup')
  .option('--key <value>', 'API key to use')
  .action((opts) => { run(ConfigSetupCmd, { options: opts }) })

config.command('set').description('Set a config value')
  .requiredOption('--key <value>', 'Config key: vendor, feed-render, feed-width')
  .requiredOption('--value <value>', 'Value to set')
  .action((opts) => { run(ConfigSetCmd, { options: opts }) })

config.command('env').description('Show environment variables')
  .action(() => { run(ConfigEnvCmd) })

config.command('nuke').description('Delete all config and data')
  .option('--confirm', 'Pass to confirm deletion', false)
  .action((opts) => { run(ConfigNukeCmd, { options: opts }) })

config.command('skill').description('Manage Claude skill integration')
  .option('--install', 'Install to ~/.claude/skills/sonar/SKILL.md', false)
  .option('--dest <value>', 'Write to a custom path')
  .option('--force', 'Overwrite even if file was modified', false)
  .action((opts) => { run(ConfigSkillCmd, { options: opts }) })

// ── sonar data ──────────────────────────────────────────────────────
const data = program.command('data').description('Manage local data')

data.command('pull').description('Download data from API')
  .option('--debug', 'Show request timing', false)
  .option('--force', 'Delete local DB and pull everything', false)
  .action((opts) => { run(DataPullCmd, { options: opts }) })

data.command('export').description('Export tweets as CSV or JSON')
  .option('--window <value>', 'Time window (e.g. 3d, 12h, 1w)', '3d')
  .option('--format <value>', 'Output format: csv|json', 'csv')
  .action((opts) => { run(DataExportCmd, { options: opts }) })

data.command('path').description('Show database path')
  .action(() => { run(DataPathCmd) })

data.command('backup').description('Backup local database')
  .option('--out <value>', 'Backup output path (default: ~/.sonar/data-backup-<timestamp>.db)')
  .option('--json', 'Raw JSON output', false)
  .action((opts) => { run(DataBackupCmd, { options: opts }) })

data.command('restore').description('Restore from backup')
  .requiredOption('--from <value>', 'Backup database path to restore from')
  .option('--to <value>', 'Target database path (default: local sonar DB path)')
  .option('--json', 'Raw JSON output', false)
  .action((opts) => { run(DataRestoreCmd, { options: opts }) })

data.command('sql').description('Open SQLite shell')
  .action(() => { run(DataSqlCmd) })

data.command('verify').description('Verify database integrity')
  .option('--path <value>', 'Database path (default: local sonar DB path)')
  .option('--json', 'Raw JSON output', false)
  .action((opts) => { run(DataVerifyCmd, { options: opts }) })

// ── sonar topics ────────────────────────────────────────────────────
const topics = program.command('topics').description('Manage interest topics')
topics
  .option('--json', 'Raw JSON output', false)
  .action((opts) => { run(TopicsListCmd, { options: opts }) })

topics.command('add').description('Add a topic')
  .argument('<name>', 'Topic name or phrase')
  .option('--description <value>', 'Optional description (auto-generated if omitted)')
  .option('--json', 'Raw JSON output', false)
  .action((name: string, opts) => { run(TopicsAddCmd, { args: [name], options: opts }) })

topics.command('edit').description('Edit a topic')
  .argument('<id>', 'Topic ID')
  .option('--name <value>', 'New name')
  .option('--description <value>', 'New description')
  .option('--json', 'Raw JSON output', false)
  .action((id: string, opts) => { run(TopicsEditCmd, { args: [id], options: opts }) })

topics.command('delete').description('Delete a topic')
  .argument('<id>', 'Topic ID')
  .option('--json', 'Raw JSON output', false)
  .action((id: string, opts) => { run(TopicsDeleteCmd, { args: [id], options: opts }) })

topics.command('suggest').description('Discover new topics with AI')
  .option('--vendor <value>', 'AI vendor: openai|anthropic')
  .option('--count <n>', 'Number of suggestions (default: 5)', Number)
  .option('--json', 'Raw JSON output', false)
  .action((opts) => { run(TopicsSuggestCmd, { options: opts }) })

topics.command('view').description('View topic details')
  .argument('<id>', 'Topic ID')
  .action((id: string) => { run(TopicsViewCmd, { args: [id] }) })

// ── sonar lens ─────────────────────────────────────────────────────
const lens = program.command('lens').description('Analyze local data with AI')

lens.command('emerging').description('Accounts gaining credibility before widely discovered')
  .option('--window <value>', 'Time window (e.g. 1d, 12h, 1w)', '1d')
  .option('--vendor <value>', 'AI vendor: openai|anthropic')
  .option('--json', 'JSON output', false)
  .action((opts) => { run(LensEmergingCmd, { options: opts }) })

lens.command('diff').description('How narratives shifted between time windows')
  .option('--window <value>', 'Time window (e.g. 1d, 12h, 1w)', '1d')
  .option('--vendor <value>', 'AI vendor: openai|anthropic')
  .option('--json', 'JSON output', false)
  .action((opts) => { run(LensDiffCmd, { options: opts }) })

lens.command('experts').description('Genuine expertise separated from performative commentary')
  .option('--window <value>', 'Time window (e.g. 1d, 12h, 1w)', '1d')
  .option('--vendor <value>', 'AI vendor: openai|anthropic')
  .option('--json', 'JSON output', false)
  .action((opts) => { run(LensExpertsCmd, { options: opts }) })

lens.command('contrarian').description('Credible people disagreeing with consensus')
  .option('--window <value>', 'Time window (e.g. 1d, 12h, 1w)', '1d')
  .option('--vendor <value>', 'AI vendor: openai|anthropic')
  .option('--json', 'JSON output', false)
  .action((opts) => { run(LensContrarianCmd, { options: opts }) })

lens.command('blindspots').description('Important conversations your network is missing')
  .option('--window <value>', 'Time window (e.g. 1d, 12h, 1w)', '1d')
  .option('--vendor <value>', 'AI vendor: openai|anthropic')
  .option('--json', 'JSON output', false)
  .action((opts) => { run(LensBlindspotCmd, { options: opts }) })


// ── Parse ───────────────────────────────────────────────────────────
await program.parseAsync()
