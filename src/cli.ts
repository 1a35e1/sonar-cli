#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Pastel from 'pastel'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))

const HEADER = `
     S O N A R
     ────────────────────────
     ${pkg.version}
`

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(HEADER)
}

const app = new Pastel({ importMeta: import.meta, name: 'sonar' })
await app.run()
