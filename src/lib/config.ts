import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CONFIG_DIR = join(homedir(), '.sonar')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

export type Vendor = 'openai' | 'anthropic'

export interface Config {
  token: string
  apiUrl: string
  vendor?: Vendor
  feedRender?: string
  feedWidth?: number
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
  if (existsSync(join(CONFIG_DIR, 'database.sqlite'))) {
    unlinkSync(join(CONFIG_DIR, 'database.sqlite'))
  }
}

export function writeConfig(config: Partial<Config>): void {
  const current = readConfig()
  const updated: Config = { ...current, ...config }
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8')
}

export function getToken(): string {
  // SONAR_API_KEY env var takes highest priority
  const apiKey = process.env.SONAR_API_KEY
  if (apiKey) return apiKey

  // Fall back to config file token
  const config = readConfig()
  if (config.token) return config.token

  process.stderr.write('No token found. Set SONAR_API_KEY or run: sonar config setup\n')
  process.exit(1)
}

export function getApiUrl(): string {
  const config = readConfig()
  return (
    process.env.SONAR_API_URL ??
    config.apiUrl ??
    'https://api.sonar.8640p.info/graphql'
  )
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
