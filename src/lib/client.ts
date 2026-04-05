import { getApiUrl, getToken } from './config.js'

interface Flags {
  debug?: boolean
  /** Request timeout in milliseconds. Defaults to 20 000 ms. */
  timeoutMs?: number
}

/**
 * Execute a GraphQL request against the Sonar API.
 *
 * A hard timeout (default 20 s) is applied via AbortController so that the
 * process never hangs silently when the server is unresponsive.  The timeout
 * is intentionally surfaced as a distinct error so callers can give operators
 * an actionable message (e.g. "check server health / retry").
 */
export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  flags: Flags = {},
): Promise<T> {
  const token = getToken()
  const url = getApiUrl()
  const timeoutMs = flags.timeoutMs ?? 20_000

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
