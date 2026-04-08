/**
 * Shared utilities for the data backup/restore/verify commands.
 */
import { copyFileSync, existsSync, rmSync } from 'node:fs'
import pkg from 'node-sqlite3-wasm'
const { Database } = pkg

/**
 * Run SQLite's built-in integrity_check pragma on the given database file.
 * Returns `'ok'` when the database is healthy.
 */
export function integrityCheck(path: string): string {
  const db = new Database(path, { readOnly: true })
  try {
    const row = db.get('PRAGMA integrity_check') as { integrity_check: string } | undefined
    return row?.integrity_check ?? 'unknown'
  } finally {
    db.close()
  }
}

/**
 * Copy a SQLite DB file together with any WAL / SHM sidecars that exist.
 */
export function copyDbWithSidecars(src: string, dst: string): void {
  copyFileSync(src, dst)
  for (const ext of ['-wal', '-shm']) {
    if (existsSync(`${src}${ext}`)) {
      copyFileSync(`${src}${ext}`, `${dst}${ext}`)
    } else {
      rmSync(`${dst}${ext}`, { force: true })
    }
  }
}
