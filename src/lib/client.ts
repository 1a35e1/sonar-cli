import { getApiUrl, getToken } from './config.js'

interface Flags {
  debug?: boolean
  /** Request timeout in milliseconds. Defaults to 20 000 ms. */
  timeoutMs?: number
}

// Default to 3 retries: enough to survive a brief server blip or a single
// bad request cycle without making the user wait through many slow failures.
// Set SONAR_MAX_RETRIES=0 to disable retries entirely (useful in scripts where
// you want to fail fast and handle errors in the calling process).
const MAX_RETRIES = Math.max(0, Number(process.env.SONAR_MAX_RETRIES) || 3)

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Jittered exponential backoff: delay doubles with each attempt (1 s, 2 s,
// 4 s, …) but is capped at 10 s so a flaky server doesn't make the CLI feel
// frozen. The random ±500 ms jitter prevents a thundering-herd effect if
// multiple CLI processes retry at the same instant.
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
  // 20 s covers normal API latency with comfortable headroom. Callers can
  // raise this for known slow queries (e.g. large dataset exports).
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
