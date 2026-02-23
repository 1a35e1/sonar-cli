import type { Vendor } from './config.js'

function extractJSON(text: string): string {
  // Strip markdown fences if present
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  // Find the outermost JSON object in case there's surrounding prose
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in response')
  return stripped.slice(start, end + 1)
}

export interface GeneratedInterest {
  name: string
  description: string
  keywords: string[]
  relatedTopics: string[]
}

const SYSTEM_PROMPT = `You generate structured interest profiles for a social intelligence tool. These profiles are embedded into a vector database and matched against tweets and people on X (Twitter). Every field must be optimised for semantic similarity search — not for human reading.

Before generating the profile, research what is currently topical and actively being discussed in this space: recent releases, emerging tools, ongoing debates, notable events, new protocols, and people generating buzz right now. Weave this current signal throughout every field.

Given a user's prompt, expand it into a rich interest profile and return a JSON object with exactly these fields:

- name: short, specific interest name (3-6 words, title case)
- description: a dense, jargon-rich passage written in the voice of a practitioner deeply embedded in this space. Do NOT describe or summarise the interest — instead write AS IF you are someone active in this community right now. Pack it with domain-specific terminology, key concepts, tools, protocols, notable figures, current debates, and recent developments. Reference what is actively being discussed and shipped today. Think: what would a knowledgeable tweet thread about this topic sound like this week? This is the most important field for vector matching.
- keywords: 12-20 specific, high-signal terms used by practitioners. Include:
    - Core technical terms and jargon
    - Key tools, frameworks, protocols, or products — especially recently launched or trending ones
    - Community hashtags (without #)
    - Names of people, projects, or companies actively discussed right now
    - Abbreviations alongside their full forms
- relatedTopics: 6-10 adjacent topic areas practitioners in this space also commonly engage with right now. Used for second-degree discovery.

Optimise every field for semantic density and current relevance, not readability.

Respond ONLY with valid JSON, no markdown, no explanation.`

/**
 * Wraps fetch() with an AbortController timeout.
 * Throws a descriptive error when the deadline is reached so callers can
 * surface an actionable message (vendor name, elapsed time, next steps).
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  vendorLabel: string,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `${vendorLabel} request timed out after ${timeoutMs / 1000}s.\n` +
        'Possible causes:\n' +
        '  • The AI provider is overloaded or rate-limiting you\n' +
        '  • Your network connection is slow or unstable\n' +
        '  • The web_search tool (OpenAI) took longer than usual\n' +
        'Try again in a moment, or use --vendor to switch providers.'
      )
    }
    throw err
  }
}

// OpenAI uses web_search_preview which can legitimately take 30-60 s.
const OPENAI_TIMEOUT_MS = 90_000
// Anthropic calls are simpler — 60 s is generous.
const ANTHROPIC_TIMEOUT_MS = 60_000

async function callOpenAI(prompt: string, apiKey: string): Promise<GeneratedInterest> {
  const res = await fetchWithTimeout(
    'https://api.openai.com/v1/responses',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        tools: [{ type: 'web_search_preview' }],
        instructions: SYSTEM_PROMPT,
        input: prompt,
      }),
    },
    OPENAI_TIMEOUT_MS,
    'OpenAI',
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenAI error: ${(err as any)?.error?.message ?? res.status}`)
  }

  const data = await res.json()
  const text = data.output
    ?.filter((b: any) => b.type === 'message')
    .flatMap((b: any) => b.content)
    .filter((c: any) => c.type === 'output_text')
    .map((c: any) => c.text)
    .join('') ?? ''

  return JSON.parse(extractJSON(text)) as GeneratedInterest
}

async function callAnthropic(prompt: string, apiKey: string): Promise<GeneratedInterest> {
  const res = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    },
    ANTHROPIC_TIMEOUT_MS,
    'Anthropic',
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Anthropic error: ${(err as any)?.error?.message ?? res.status}`)
  }

  const data = await res.json()
  return JSON.parse(extractJSON(data.content[0].text)) as GeneratedInterest
}

export interface GeneratedReply {
  reply: string
}

const REPLY_SYSTEM_PROMPT = `You are a concise, contextual tweet reply writer. Write a single reply tweet (max 280 characters) that is natural, engaging, and relevant to the original tweet. Do not use hashtags unless essential. Do not include any explanation or preamble. Return only valid JSON with a single "reply" field containing the reply text.`

async function callOpenAIReply(tweetText: string, userPrompt: string, apiKey: string): Promise<GeneratedReply> {
  const userContent = userPrompt
    ? `Original tweet: "${tweetText}"\n\nAngle for reply: ${userPrompt}`
    : `Original tweet: "${tweetText}"\n\nWrite a thoughtful reply.`

  const res = await fetchWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: REPLY_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    },
    OPENAI_TIMEOUT_MS,
    'OpenAI',
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenAI error: ${(err as any)?.error?.message ?? res.status}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  return JSON.parse(extractJSON(text)) as GeneratedReply
}

async function callAnthropicReply(tweetText: string, userPrompt: string, apiKey: string): Promise<GeneratedReply> {
  const userContent = userPrompt
    ? `Original tweet: "${tweetText}"\n\nAngle for reply: ${userPrompt}`
    : `Original tweet: "${tweetText}"\n\nWrite a thoughtful reply.`

  const res = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: REPLY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    },
    ANTHROPIC_TIMEOUT_MS,
    'Anthropic',
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Anthropic error: ${(err as any)?.error?.message ?? res.status}`)
  }

  const data = await res.json()
  return JSON.parse(extractJSON(data.content[0].text)) as GeneratedReply
}

export async function generateReply(
  tweetText: string,
  userPrompt: string,
  vendor: Vendor,
): Promise<GeneratedReply> {
  if (vendor === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
    return callOpenAIReply(tweetText, userPrompt, apiKey)
  }

  if (vendor === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    return callAnthropicReply(tweetText, userPrompt, apiKey)
  }

  throw new Error(`Unknown vendor: ${vendor}. Supported: openai, anthropic`)
}

export async function generateInterest(prompt: string, vendor: Vendor): Promise<GeneratedInterest> {
  if (vendor === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
    return callOpenAI(prompt, apiKey)
  }

  if (vendor === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    return callAnthropic(prompt, apiKey)
  }

  throw new Error(`Unknown vendor: ${vendor}. Supported: openai, anthropic`)
}
