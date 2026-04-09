import { getApiUrl, getToken } from './config.js'

interface Flags {
  debug?: boolean
  /** Request timeout in milliseconds. Defaults to 20 000 ms. */
  timeoutMs?: number
  /**
   * When true and a 429 rate-limit response is received, the client will
   * wait until the reset window elapses (with a countdown on stderr) and
   * retry automatically.  When false (default) a RateLimitError is thrown.
   */
  wait?: boolean
}

/** Thrown when the API responds with HTTP 429 and --wait was not supplied. */
export class RateLimitError extends Error {
  readonly resetAt: Date | null
  readonly retryAfterSeconds: number | null

  constructor(resetAt: Date | null, retryAfterSeconds: number | null) {
    const parts = ['X API rate limit reached.']
    if (resetAt) parts.push(`Resets at ${resetAt.toUTCString()}.`)
    parts.push('Use --wait to auto-retry.')
    super(parts.join(' '))
    this.name = 'RateLimitError'
    this.resetAt = resetAt
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function parseRateLimitHeaders(res: Response): { resetAt: Date | null; retryAfterSeconds: number | null } {
  // X API v2 uses unix-timestamp reset header
  const resetHeader = res.headers.get('x-rate-limit-reset') ?? res.headers.get('x-ratelimit-reset')
  let resetAt: Date | null = null
  if (resetHeader) {
    const ts = Number(resetHeader)
    if (!Number.isNaN(ts)) resetAt = new Date(ts * 1000)
  }

  // Standard Retry-After (seconds or HTTP date)
  let retryAfterSeconds: number | null = null
  const retryAfter = res.headers.get('retry-after')
  if (retryAfter) {
    const secs = Number(retryAfter)
    if (!Number.isNaN(secs)) {
      retryAfterSeconds = secs
      if (!resetAt) resetAt = new Date(Date.now() + secs * 1000)
    } else {
      const d = new Date(retryAfter)
      if (!Number.isNaN(d.getTime())) {
        resetAt = resetAt ?? d
        retryAfterSeconds = Math.ceil((d.getTime() - Date.now()) / 1000)
      }
    }
  }

  return { resetAt, retryAfterSeconds }
}

async function sleepWithCountdown(waitMs: number, resetAt: Date | null): Promise<void> {
  const label = resetAt ? `until ${resetAt.toUTCString()}` : `${Math.ceil(waitMs / 1000)}s`
  process.stderr.write(`Rate limited — waiting ${label}\n`)
  const end = Date.now() + waitMs
  while (Date.now() < end) {
    const remaining = Math.ceil((end - Date.now()) / 1000)
    process.stderr.write(`\rRetrying in ${remaining}s...  `)
    await sleep(Math.min(1000, end - Date.now()))
  }
  process.stderr.write('\r\x1b[K')
}

const MAX_RETRIES = Math.max(0, Number(process.env.SONAR_MAX_RETRIES) || 3)

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function retryDelay(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 10_000)
  return base + Math.random() * 500
}

/**
 * Execute a GraphQL request against the Sonar API.
 *
 * Retries transient failures (network errors, 5xx) with jittered exponential
 * backoff.  Deterministic failures (4xx, GraphQL errors) throw immediately.
 * Control retries via SONAR_MAX_RETRIES env var (default 3, 0 to disable).
 *
 * A hard timeout (default 20 s) is applied via AbortController so that the
 * process never hangs silently when the server is unresponsive.
 */
export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  flags: Flags = {},
): Promise<T> {
  const token = getToken()
  const url = getApiUrl()
  const timeoutMs = flags.timeoutMs ?? 20_000

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let res: Response
    try {
      if (flags.debug) {
        console.error(url, query, variables)
      }
      res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
      })
    } catch (err: unknown) {
      clearTimeout(timer)
      if (attempt < MAX_RETRIES) {
        if (flags.debug) console.error(`Retry ${attempt + 1}/${MAX_RETRIES} after network error`)
        await sleep(retryDelay(attempt))
        continue
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(
          `Request timed out after ${timeoutMs / 1000}s. ` +
          'The server may be overloaded or unreachable. ' +
          'Check SONAR_API_URL, your network connection, and retry.'
        )
      }
      throw new Error('Unable to reach server, please try again shortly.')
    } finally {
      clearTimeout(timer)
    }

    // 5xx — transient, retry
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      if (flags.debug) console.error(`Retry ${attempt + 1}/${MAX_RETRIES} after HTTP ${res.status}`)
      await sleep(retryDelay(attempt))
      continue
    }

    // 429 — rate limited
    if (res.status === 429) {
      const { resetAt, retryAfterSeconds } = parseRateLimitHeaders(res)
      if (flags.wait) {
        const waitMs = resetAt
          ? Math.max(0, resetAt.getTime() - Date.now())
          : (retryAfterSeconds ?? 60) * 1000
        await sleepWithCountdown(waitMs, resetAt)
        continue
      }
      throw new RateLimitError(resetAt, retryAfterSeconds)
    }

    // 4xx — deterministic, throw immediately
    if (!res.ok) {
      if (flags.debug) {
        console.error(JSON.stringify(await res.json(), null, 2))
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    const json = (await res.json()) as {
      data?: T
      errors?: Array<{ message: string }>
    }

    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0].message)
    }

    return json.data as T
  }

  throw new Error('Unexpected retry exhaustion')
}
