import { getApiUrl, getToken } from './config.js'

interface Flags {
  debug?: boolean
}

export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  flags: Flags = {},
): Promise<T> {
  const token = getToken()
  const url = getApiUrl()

  let res: Response
  try {

    if (flags.debug) {
      console.error(url, query, variables)
    }
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    })
  } catch {
    throw new Error('Unable to reach server, please try again shortly.')
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
