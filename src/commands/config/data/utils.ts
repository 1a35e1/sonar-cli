/**
 * Shared utilities for the data backup/restore/verify commands.
 */
import { copyFileSync, existsSync, rmSync } from 'node:fs'
import Database from 'better-sqlite3'

/**
 * Run SQLite's built-in integrity_check pragma on the given database file.
 * Returns `'ok'` when the database is healthy.
 *
 * The DB handle is always closed — even when the pragma throws — so callers
 * never have to worry about leaked file descriptors.
 */
export function integrityCheck(path: string): string {
  const db = new Database(path, { readonly: true })
  try {
    const rows = db.pragma('integrity_check') as Array<Record<string, string>>
    const first = Object.values(rows[0] ?? {})[0]
    return String(first ?? 'unknown')
  } finally {
    db.close()
  }
}

/**
 * Copy a SQLite DB file together with any WAL / SHM sidecars that exist.
 * If a sidecar does not exist at the source it is removed from the destination
 * (so that the destination remains self-consistent).
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
