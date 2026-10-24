import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../database/schema'

let database: ReturnType<typeof drizzle<typeof schema>> | undefined

export function getDb() {
  if (database) {
    return database
  }

  const { databaseUrl: configuredUrl } = useRuntimeConfig()
  const databaseUrl = process.env.DATABASE_URL || configuredUrl
  const databasePath = isAbsolute(databaseUrl)
    ? databaseUrl
    : resolve(process.cwd(), databaseUrl)

  mkdirSync(dirname(databasePath), { recursive: true })
  const sqlite = new Database(databasePath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS archive_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `)
  database = drizzle(sqlite, { schema })
  return database
}
