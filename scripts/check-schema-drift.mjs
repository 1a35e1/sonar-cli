import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildClientSchema,
  getIntrospectionQuery,
  parse,
  validate,
} from 'graphql'

const ROOT = process.cwd()
const SRC_DIR = join(ROOT, 'src')
const defaultSchemaUrl = 'https://api.sonar.8640p.info/graphql'
const rawSchemaUrl = process.env.SONAR_API_URL ?? defaultSchemaUrl
const schemaUrl = rawSchemaUrl.endsWith('/graphql')
  ? rawSchemaUrl
  : `${rawSchemaUrl.replace(/\/$/, '')}/graphql`

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(full)) out.push(full)
  }
  return out
}

function extractGraphqlDocuments(source) {
  const docs = []

  // gql`...`
  const gqlTag = /gql`([\s\S]*?)`/g
  for (const match of source.matchAll(gqlTag)) {
    docs.push(match[1])
  }

  // Plain template literals often used in CLI commands: const QUERY = `...`
  const plainTemplate = /=\s*`([\s\S]*?)`/g
  for (const match of source.matchAll(plainTemplate)) {
    const body = match[1]
    if (/\b(query|mutation|fragment)\b/.test(body)) {
      docs.push(body)
    }
  }

  return docs
}

async function fetchSchema() {
  try {
    const res = await fetch(schemaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: getIntrospectionQuery() }),
    })
    if (!res.ok) {
      throw new Error(`Schema introspection failed: HTTP ${res.status} ${res.statusText}`)
    }
    const json = await res.json()
    if (!json?.data) {
      throw new Error('Schema introspection returned no data.')
    }
    return buildClientSchema(json.data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!process.env.CI) {
      process.stdout.write(
        `Schema validation skipped (network unavailable): ${msg}\n` +
          'Set CI=true to enforce this check.\n',
      )
      return null
    }
    throw error
  }
}

const files = walk(SRC_DIR)
const docsByFile = []
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const docs = extractGraphqlDocuments(source)
  if (docs.length > 0) {
    docsByFile.push([file, docs])
  }
}

if (docsByFile.length === 0) {
  process.stderr.write('No GraphQL documents found in src.\n')
  process.exit(1)
}

const schema = await fetchSchema()
if (!schema) {
  process.exit(0)
}
const failures = []

for (const [file, docs] of docsByFile) {
  for (const doc of docs) {
    try {
      const ast = parse(doc)
      const errs = validate(schema, ast)
      if (errs.length > 0) {
        for (const err of errs) {
          failures.push(`${file}: ${err.message}`)
        }
      }
    } catch (error) {
      failures.push(`${file}: ${(error instanceof Error ? error.message : String(error))}`)
    }
  }
}

if (failures.length > 0) {
  process.stderr.write('Schema drift detected in GraphQL documents:\n')
  for (const failure of failures) {
    process.stderr.write(`- ${failure}\n`)
  }
  process.exit(1)
}

process.stdout.write(`Schema validation passed against ${schemaUrl}.\n`)
