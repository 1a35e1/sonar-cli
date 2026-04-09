import type { Vendor } from './config.js'

// ─── Vendor Response Types ──────────────────────────────────────────────────

interface VendorErrorBody {
  error?: { message?: string }
}

interface OpenAIResponsesContent {
  type: string
  text?: string
}

interface OpenAIResponsesOutputItem {
  type: string
  content?: OpenAIResponsesContent[]
}

interface OpenAIResponsesResult {
  output?: OpenAIResponsesOutputItem[]
}

interface OpenAIChatCompletionResult {
  choices?: { message: { role: string; content: string | null } }[]
}

interface AnthropicContentBlock {
  type: string
  text?: string
  input?: unknown
}

interface AnthropicMessagesResult {
  content?: AnthropicContentBlock[]
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the outermost JSON object from a string that may contain markdown
 * fences or surrounding prose. Exported for testing and use as a fallback.
 */
export function extractJSON(text: string): string {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in response')
  return stripped.slice(start, end + 1)
}

/**
 * Extracts the outermost JSON array from a string that may contain markdown
 * fences or surrounding prose. Exported for testing and use as a fallback.
 */
export function extractJSONArray(text: string): string {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = stripped.indexOf('[')
  const end = stripped.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error('No JSON array found in response')
  return stripped.slice(start, end + 1)
}

/**
 * Parses a JSON string into type T. Throws a clear error (not a raw SyntaxError)
 * when the response cannot be parsed, so callers see a useful message.
 */
export function parseJSON<T>(text: string, context = 'AI response'): T {
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(
      `Failed to parse ${context} as JSON. ` +
      `Received: ${text.length > 200 ? text.slice(0, 200) + '…' : text}`,
    )
  }
}

export interface GeneratedInterest {
  name: string
  description: string
  keywords: string[]
  relatedTopics: string[]
}

const INTEREST_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
    relatedTopics: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'description', 'keywords', 'relatedTopics'],
  additionalProperties: false,
}

const INTEREST_ARRAY_TOOL_SCHEMA = {
  type: 'array',
  items: INTEREST_TOOL_SCHEMA,
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

// OpenAI uses web_search_preview which can legitimately take 30-60 s.
export const OPENAI_TIMEOUT_MS = 90_000
// Anthropic calls are simpler — 60 s is generous.
export const ANTHROPIC_TIMEOUT_MS = 60_000

/**
 * Wraps fetch() with an AbortController timeout that covers the full response
 * cycle — headers AND body. The processResponse callback receives the Response
 * and is responsible for consuming the body (e.g. calling res.json()). The
 * timer is kept alive until processResponse resolves or rejects, ensuring a
 * stalled body download is caught just like a stalled connection.
 */
async function fetchWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  vendorLabel: string,
  processResponse: (res: Response) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    return await processResponse(res)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const lines: string[] = [
        `${vendorLabel} request timed out after ${timeoutMs / 1000}s.`,
        'Possible causes:',
        '  • The AI provider is overloaded or rate-limiting you',
        '  • Your network connection is slow or unstable',
      ]
      if (vendorLabel.toLowerCase().includes('openai')) {
        lines.push('  • The web_search tool (OpenAI) took longer than usual')
      }
      lines.push('Try again in a moment, or use --vendor to switch providers.')
      throw new Error(lines.join('\n'))
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function callOpenAI(prompt: string, apiKey: string): Promise<GeneratedInterest> {
  return fetchWithTimeout(
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
        text: {
          format: {
            type: 'json_schema',
            name: 'interest',
            schema: INTEREST_TOOL_SCHEMA,
            strict: true,
          },
        },
        instructions: SYSTEM_PROMPT,
        input: prompt,
      }),
    },
    OPENAI_TIMEOUT_MS,
    'OpenAI',
    async (res) => {
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as VendorErrorBody
        throw new Error(`OpenAI error: ${err.error?.message ?? res.status}`)
      }
      const data = (await res.json()) as OpenAIResponsesResult
      const text = data.output
        ?.filter((b) => b.type === 'message')
        .flatMap((b) => b.content ?? [])
        .filter((c) => c.type === 'output_text')
        .map((c) => c.text ?? '')
        .join('') ?? ''
      return parseJSON<GeneratedInterest>(text, 'OpenAI interest response')
    },
  )
}

async function callAnthropic(prompt: string, apiKey: string): Promise<GeneratedInterest> {
  return fetchWithTimeout(
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
        tools: [
          {
            name: 'generate_interest',
            description: 'Return a structured interest profile',
            input_schema: INTEREST_TOOL_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: 'generate_interest' },
      }),
    },
    ANTHROPIC_TIMEOUT_MS,
    'Anthropic',
    async (res) => {
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as VendorErrorBody
        throw new Error(`Anthropic error: ${err.error?.message ?? res.status}`)
      }
      const data = (await res.json()) as AnthropicMessagesResult
      const toolBlock = data.content?.find((b) => b.type === 'tool_use')
      if (!toolBlock?.input) {
        throw new Error('Anthropic response did not include a tool_use block with structured output')
      }
      return toolBlock.input as GeneratedInterest
    },
  )
}

export interface GeneratedReply {
  reply: string
}

const REPLY_SYSTEM_PROMPT = `You are a concise, contextual tweet reply writer. Write a single reply tweet (max 280 characters) that is natural, engaging, and relevant to the original tweet. Do not use hashtags unless essential. Do not include any explanation or preamble. Return only valid JSON with a single "reply" field containing the reply text.`

const REPLY_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
  },
  required: ['reply'],
  additionalProperties: false,
}

async function callOpenAIReply(tweetText: string, userPrompt: string, apiKey: string): Promise<GeneratedReply> {
  const userContent = userPrompt
    ? `Original tweet: "${tweetText}"\n\nAngle for reply: ${userPrompt}`
    : `Original tweet: "${tweetText}"\n\nWrite a thoughtful reply.`

  return fetchWithTimeout(
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
        response_format: { type: 'json_object' },
      }),
    },
    OPENAI_TIMEOUT_MS,
    'OpenAI',
    async (res) => {
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as VendorErrorBody
        throw new Error(`OpenAI error: ${err.error?.message ?? res.status}`)
      }
      const data = (await res.json()) as OpenAIChatCompletionResult
      const text = data.choices?.[0]?.message?.content ?? ''
      return parseJSON<GeneratedReply>(text, 'OpenAI reply response')
    },
  )
}

async function callAnthropicReply(tweetText: string, userPrompt: string, apiKey: string): Promise<GeneratedReply> {
  const userContent = userPrompt
    ? `Original tweet: "${tweetText}"\n\nAngle for reply: ${userPrompt}`
    : `Original tweet: "${tweetText}"\n\nWrite a thoughtful reply.`

  return fetchWithTimeout(
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
        tools: [
          {
            name: 'generate_reply',
            description: 'Return a structured tweet reply',
            input_schema: REPLY_TOOL_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: 'generate_reply' },
      }),
    },
    ANTHROPIC_TIMEOUT_MS,
    'Anthropic',
    async (res) => {
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as VendorErrorBody
        throw new Error(`Anthropic error: ${err.error?.message ?? res.status}`)
      }
      const data = (await res.json()) as AnthropicMessagesResult
      const toolBlock = data.content?.find((b) => b.type === 'tool_use')
      if (!toolBlock?.input) {
        throw new Error('Anthropic response did not include a tool_use block with structured output')
      }
      return toolBlock.input as GeneratedReply
    },
  )
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

// ─── Topic Suggestions ───────────────────────────────────────────────────────

const SUGGEST_SYSTEM_PROMPT = `You suggest new topics for a social intelligence tool that tracks interests on X (Twitter). Given the user's existing topics and a sample of recent tweets from their feed, suggest new topics that are adjacent to but distinct from what they already track.

For each suggestion, return a JSON object with:
- name: short, specific interest name (3-6 words, title case)
- description: a dense, jargon-rich passage written in the voice of a practitioner deeply embedded in this space. Pack it with domain-specific terminology, key concepts, tools, notable figures, and current developments.
- keywords: 12-20 specific, high-signal terms used by practitioners
- relatedTopics: 6-10 adjacent topic areas

Respond ONLY with a valid JSON array of objects. No markdown, no explanation.`

export async function generateTopicSuggestions(
  existingTopics: string[],
  recentTweets: string[],
  count: number,
  vendor: Vendor,
): Promise<GeneratedInterest[]> {
  const topicList = existingTopics.length > 0
    ? `My current topics:\n${existingTopics.map(t => `- ${t}`).join('\n')}`
    : 'I have no topics yet.'

  const tweetSample = recentTweets.length > 0
    ? `\n\nRecent tweets from my feed:\n${recentTweets.slice(0, 15).map(t => `- ${t.slice(0, 200)}`).join('\n')}`
    : ''

  const prompt = `${topicList}${tweetSample}\n\nSuggest exactly ${count} new topics I should track. Return a JSON array.`

  if (vendor === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
    return fetchWithTimeout(
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
          text: {
            format: {
              type: 'json_schema',
              name: 'interest_suggestions',
              schema: INTEREST_ARRAY_TOOL_SCHEMA,
              strict: true,
            },
          },
          instructions: SUGGEST_SYSTEM_PROMPT,
          input: prompt,
        }),
      },
      OPENAI_TIMEOUT_MS,
      'OpenAI',
      async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as VendorErrorBody
          throw new Error(`OpenAI error: ${err.error?.message ?? res.status}`)
        }
        const data = (await res.json()) as OpenAIResponsesResult
        const text = data.output
          ?.filter((b) => b.type === 'message')
          .flatMap((b) => b.content ?? [])
          .filter((c) => c.type === 'output_text')
          .map((c) => c.text ?? '')
          .join('') ?? ''
        return parseJSON<GeneratedInterest[]>(text, 'OpenAI suggestions response')
      },
    )
  }

  if (vendor === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    return fetchWithTimeout(
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
          max_tokens: 4096,
          system: SUGGEST_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
          tools: [
            {
              name: 'generate_suggestions',
              description: 'Return an array of structured interest profiles',
              input_schema: {
                type: 'object',
                properties: {
                  suggestions: INTEREST_ARRAY_TOOL_SCHEMA,
                },
                required: ['suggestions'],
                additionalProperties: false,
              },
            },
          ],
          tool_choice: { type: 'tool', name: 'generate_suggestions' },
        }),
      },
      ANTHROPIC_TIMEOUT_MS,
      'Anthropic',
      async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as VendorErrorBody
          throw new Error(`Anthropic error: ${err.error?.message ?? res.status}`)
        }
        const data = (await res.json()) as AnthropicMessagesResult
        const toolBlock = data.content?.find((b) => b.type === 'tool_use')
        if (!toolBlock?.input) {
          throw new Error('Anthropic response did not include a tool_use block with structured output')
        }
        const wrapper = toolBlock.input as { suggestions: GeneratedInterest[] }
        return wrapper.suggestions
      },
    )
  }

  throw new Error(`Unknown vendor: ${vendor}. Supported: openai, anthropic`)
}
