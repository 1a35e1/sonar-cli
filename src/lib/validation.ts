/**
 * Input validation for user-facing fields.
 * All validators return an error message string on failure, or null on success.
 */

const NAME_MIN = 1
const NAME_MAX = 100
const DESCRIPTION_MAX = 2000
const KEYWORD_MAX = 60
const KEYWORDS_MAX_COUNT = 30

// Control characters (except tab) are disallowed in names
const CONTROL_CHAR_RE = /[\x00-\x08\x0b-\x1f\x7f]/

export function validateTopicName(name: string): string | null {
  const trimmed = name.trim()

  if (trimmed.length < NAME_MIN) {
    return `Topic name must not be empty.`
  }

  if (name.length > NAME_MAX) {
    return `Topic name is too long (max ${NAME_MAX} characters, got ${name.length}).`
  }

  if (CONTROL_CHAR_RE.test(name)) {
    return `Topic name contains invalid characters (control characters are not allowed).`
  }

  return null
}

export function validateDescription(description: string): string | null {
  if (description.length > DESCRIPTION_MAX) {
    return `Description is too long (max ${DESCRIPTION_MAX} characters, got ${description.length}).`
  }

  if (CONTROL_CHAR_RE.test(description)) {
    return `Description contains invalid characters (control characters are not allowed).`
  }

  return null
}

export function validateKeyword(keyword: string): string | null {
  const trimmed = keyword.trim()

  if (trimmed.length === 0) {
    return `Keywords must not be empty.`
  }

  if (keyword.length > KEYWORD_MAX) {
    return `Keyword "${keyword.slice(0, 20)}..." is too long (max ${KEYWORD_MAX} characters).`
  }

  if (CONTROL_CHAR_RE.test(keyword)) {
    return `Keyword "${keyword.slice(0, 20)}" contains invalid characters.`
  }

  return null
}

export function validateKeywordList(keywords: string[]): string | null {
  if (keywords.length > KEYWORDS_MAX_COUNT) {
    return `Too many keywords (max ${KEYWORDS_MAX_COUNT}, got ${keywords.length}).`
  }

  for (const kw of keywords) {
    const err = validateKeyword(kw)
    if (err) return err
  }

  return null
}
