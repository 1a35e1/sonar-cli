import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DB_PATH } from './db.js'

const CONFIG_DIR = join(homedir(), '.sonar')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')
const ACCOUNTS_FILE = join(CONFIG_DIR, 'accounts.json')

export type Vendor = 'openai' | 'anthropic'

export interface Config {
  token: string
  apiUrl: string
  vendor?: Vendor
  feedRender?: string
  feedWidth?: number
}

export interface AccountEntry {
  token: string
  apiUrl: string
}

export interface AccountsFile {
  active: string
  accounts: Record<string, AccountEntry>
}

export function readConfig(): Config {
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8')
    return JSON.parse(raw) as Config
  } catch {
    return {
      token: '',
      apiUrl: process.env.SONAR_API_URL ?? 'https://api.sonar.8640p.info/graphql',
    }
  }
}

export function configExists(): boolean {
  return existsSync(CONFIG_FILE)
}

export function deleteConfig(): void {
  if (configExists()) {
    unlinkSync(CONFIG_FILE)
  }
}

export function deleteDatabase(): void {
  if (existsSync(DB_PATH)) {
    unlinkSync(DB_PATH)
  }
}

export function writeConfig(config: Partial<Config>): void {
  const current = readConfig()
  const updated: Config = { ...current, ...config }
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8')
}

// ─── Accounts ────────────────────────────────────────────────────────────────

const DEFAULT_API_URL = 'https://api.sonar.8640p.info/graphql'

export function readAccounts(): AccountsFile {
  try {
    const raw = readFileSync(ACCOUNTS_FILE, 'utf8')
    return JSON.parse(raw) as AccountsFile
  } catch {
    return { active: '', accounts: {} }
  }
}

export function writeAccounts(data: AccountsFile): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), 'utf8')
}

export function accountsExist(): boolean {
  return existsSync(ACCOUNTS_FILE)
}

/** Migrate legacy config.json token into accounts.json as "default". */
export function migrateToAccounts(): void {
  if (accountsExist()) return
  const config = readConfig()
  if (!config.token) return
  writeAccounts({
    active: 'default',
    accounts: {
      default: { token: config.token, apiUrl: config.apiUrl || DEFAULT_API_URL },
    },
  })
}

export function getActiveAccount(): { name: string; token: string; apiUrl: string } | null {
  migrateToAccounts()
  const { active, accounts } = readAccounts()
  if (!active || !accounts[active]) return null
  return { name: active, ...accounts[active] }
}

export function getToken(): string {
  // SONAR_API_KEY env var takes highest priority
  const apiKey = process.env.SONAR_API_KEY
  if (apiKey) return apiKey

  // Check accounts.json
  const account = getActiveAccount()
  if (account?.token) return account.token

  // Fall back to config file token
  const config = readConfig()
  if (config.token) return config.token

  process.stderr.write('No token found. Set SONAR_API_KEY or run: sonar account add <name> <key>\n')
  process.exit(1)
}

export function getApiUrl(): string {
  if (process.env.SONAR_API_URL) return process.env.SONAR_API_URL

  const account = getActiveAccount()
  if (account?.apiUrl) return account.apiUrl

  const config = readConfig()
  return config.apiUrl ?? DEFAULT_API_URL
}

export function getFeedRender(override?: string): string {
  return (
    override ??
    process.env.SONAR_FEED_RENDER ??
    readConfig().feedRender ??
    'card'
  )
}

export function getFeedWidth(override?: number): number {
  const env = process.env.SONAR_FEED_WIDTH
    ? Number(process.env.SONAR_FEED_WIDTH)
    : undefined
  return override ?? env ?? readConfig().feedWidth ?? 80
}

export function getVendor(override?: string): Vendor {
  const vendor =
    override ?? process.env.SONAR_AI_VENDOR ?? readConfig().vendor ?? 'openai'
  if (vendor !== 'openai' && vendor !== 'anthropic') {
    process.stderr.write(
      `Unknown vendor "${vendor}". Supported: openai, anthropic\n`,
    )
    process.exit(1)
  }
  return vendor
}
