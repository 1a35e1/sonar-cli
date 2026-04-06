import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const configSource = readFileSync(join(ROOT, 'src', 'lib', 'config.ts'), 'utf8')
const querySource = readFileSync(join(ROOT, 'src', 'lib', 'data-queries.ts'), 'utf8')
const dbSource = readFileSync(join(ROOT, 'src', 'lib', 'db.ts'), 'utf8')

const failures = []

if (configSource.includes('database.sqlite')) {
  failures.push(
    'config deleteDatabase still references legacy database.sqlite path; expected DB_PATH/data.db.',
  )
}

const interestsQueryMatch = querySource.match(
  /export const INTERESTS_QUERY\s*=\s*`([\s\S]*?)`/,
)
if (!interestsQueryMatch) {
  failures.push('Unable to locate INTERESTS_QUERY in src/lib/data-queries.ts.')
} else {
  const interestsQuery = interestsQueryMatch[1]
  if (/\bkeywords\b/.test(interestsQuery) || /\brelatedTopics\b/.test(interestsQuery)) {
    failures.push(
      'INTERESTS_QUERY still requests deprecated topics fields (keywords/relatedTopics).',
    )
  }
}

if (!dbSource.includes('export const DB_PATH =')) {
  failures.push('DB_PATH constant missing from src/lib/db.ts.')
}

if (failures.length > 0) {
  process.stderr.write('Data compatibility checks failed:\n')
  for (const failure of failures) {
    process.stderr.write(`- ${failure}\n`)
  }
  process.exit(1)
}

process.stdout.write('Data compatibility checks passed.\n')
