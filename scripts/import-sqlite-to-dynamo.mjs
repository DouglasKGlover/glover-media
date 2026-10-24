import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import Database from 'better-sqlite3'
import { isAbsolute, resolve } from 'node:path'

const databaseUrl = process.env.DATABASE_URL || './data/movies.db'
const tableName = process.env.DYNAMODB_TABLE_NAME || process.env.NUXT_DYNAMODB_TABLE_NAME
if (!tableName) throw new Error('Set DYNAMODB_TABLE_NAME to the serverless catalog table.')
if (databaseUrl === ':memory:') throw new Error('A file-backed SQLite database is required for migration.')

const databasePath = isAbsolute(databaseUrl)
  ? databaseUrl
  : resolve(process.cwd(), databaseUrl)
const sqlite = new Database(databasePath, { readonly: true, fileMustExist: true })
const rows = sqlite.prepare('SELECT * FROM movies ORDER BY id').all()
sqlite.close()

const client = new DynamoDBClient({})
let imported = 0
let alreadyImported = 0
let maxId = 0

for (const row of rows) {
  const createdAt = new Date(Number(row.created_at)).toISOString()
  const movie = {
    id: Number(row.id),
    tmdbId: Number(row.tmdb_id),
    mediaType: row.media_type || 'movie',
    title: row.title,
    releaseYear: row.release_year ?? null,
    posterPath: row.poster_path ?? null,
    overview: row.overview ?? null,
    runtime: row.runtime ?? null,
    genres: JSON.parse(row.genres || '[]'),
    format: row.format,
    edition: row.edition ?? null,
    dougWatched: Boolean(row.doug_watched),
    gilWatched: Boolean(row.gil_watched),
    dougWouldWatchAgain: Boolean(row.doug_would_watch_again),
    gilWouldWatchAgain: Boolean(row.gil_would_watch_again),
    dougRating: row.doug_rating ?? null,
    gilRating: row.gil_rating ?? null,
    notes: row.notes ?? null,
    createdAt,
  }
  if (!Number.isInteger(movie.id) || movie.id < 1 || !Number.isInteger(movie.tmdbId) || !movie.title) {
    throw new Error(`SQLite row ${String(row.id)} contains invalid movie data.`)
  }
  maxId = Math.max(maxId, movie.id)

  try {
    await client.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: { ...movie, pk: `MOVIE#${movie.id}`, sk: 'MOVIE' },
            ConditionExpression: 'attribute_not_exists(pk)',
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              pk: `TMDB#${movie.mediaType}#${movie.tmdbId}`,
              sk: 'MOVIE',
              movieId: movie.id,
            },
            ConditionExpression: 'attribute_not_exists(pk)',
          },
        },
      ],
    }))
    imported++
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'TransactionCanceledException') throw error
    const existing = await client.send(new GetCommand({
      TableName: tableName,
      Key: { pk: `TMDB#${movie.mediaType}#${movie.tmdbId}`, sk: 'MOVIE' },
      ConsistentRead: true,
    }))
    if (existing.Item?.movieId === movie.id) {
      alreadyImported++
      continue
    }
    throw new Error(
      `Could not import "${movie.title}" (SQLite ID ${movie.id}); a conflicting or partial DynamoDB record exists.`,
      { cause: error },
    )
  }
}

if (maxId > 0) {
  try {
    await client.send(new UpdateCommand({
      TableName: tableName,
      Key: { pk: 'META', sk: 'MOVIE_ID' },
      UpdateExpression: 'SET #value = :maxId',
      ConditionExpression: 'attribute_not_exists(#value) OR #value < :maxId',
      ExpressionAttributeNames: { '#value': 'value' },
      ExpressionAttributeValues: { ':maxId': maxId },
    }))
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'ConditionalCheckFailedException') throw error
  }
}

console.log(`DynamoDB import complete: ${imported} imported, ${alreadyImported} already imported.`)
