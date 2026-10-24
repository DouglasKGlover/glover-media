import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const movies = sqliteTable('movies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tmdbId: integer('tmdb_id').notNull(),
  mediaType: text('media_type', { enum: ['movie', 'tv'] }).notNull().default('movie'),
  title: text('title').notNull(),
  releaseYear: integer('release_year'),
  posterPath: text('poster_path'),
  overview: text('overview'),
  runtime: integer('runtime'),
  genres: text('genres').notNull().default('[]'),
  format: text('format').notNull(),
  edition: text('edition'),
  dougWatched: integer('doug_watched', { mode: 'boolean' }).notNull().default(false),
  gilWatched: integer('gil_watched', { mode: 'boolean' }).notNull().default(false),
  dougWouldWatchAgain: integer('doug_would_watch_again', { mode: 'boolean' }).notNull().default(false),
  gilWouldWatchAgain: integer('gil_would_watch_again', { mode: 'boolean' }).notNull().default(false),
  dougRating: integer('doug_rating'),
  gilRating: integer('gil_rating'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(cast(strftime('%s', 'now') as integer) * 1000)`),
}, table => [
  uniqueIndex('movies_media_tmdb_unique').on(table.mediaType, table.tmdbId),
])

export const archiveSessions = sqliteTable('archive_sessions', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
})
