import 'dotenv/config'
import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.DATABASE_URL || './data/movies.db'
const databasePath = isAbsolute(databaseUrl)
  ? databaseUrl
  : resolve(process.cwd(), databaseUrl)

if (databaseUrl !== ':memory:') {
  mkdirSync(dirname(databasePath), { recursive: true })
}

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: {
    url: databaseUrl,
  },
})
