import {
  DeleteCommand,
  GetCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { desc, eq } from 'drizzle-orm'
import type { Movie } from '../../shared/types/movie'
import { movies } from '../database/schema'
import { getDynamoDocumentClient, getDynamoTableName, isDynamoConfigured } from './dynamo'

type MovieChanges = Partial<Pick<Movie,
  | 'format'
  | 'edition'
  | 'dougWatched'
  | 'gilWatched'
  | 'dougWouldWatchAgain'
  | 'gilWouldWatchAgain'
  | 'dougRating'
  | 'gilRating'
  | 'notes'
>>

type NewMovie = Omit<Movie, 'id' | 'createdAt'>

type StoredMovie = Movie & { pk: string; sk: string }

async function getLocalDb() {
  return (await import('./db')).getDb()
}

export class DuplicateMovieError extends Error {
  constructor() {
    super('This title is already in the collection')
    this.name = 'DuplicateMovieError'
  }
}

function fromSqliteMovie(movie: typeof movies.$inferSelect): Movie {
  return {
    ...movie,
    genres: JSON.parse(movie.genres) as string[],
    createdAt: movie.createdAt.toISOString(),
  }
}

export async function listMovies() {
  if (!isDynamoConfigured()) {
    const rows = await (await getLocalDb())
      .select()
      .from(movies)
      .orderBy(desc(movies.createdAt))
    return rows.map(fromSqliteMovie)
  }

  const tableName = getDynamoTableName()
  const result: Movie[] = []
  let lastEvaluatedKey: Record<string, unknown> | undefined

  do {
    const page = await getDynamoDocumentClient().send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'begins_with(#pk, :moviePrefix)',
      ExpressionAttributeNames: { '#pk': 'pk' },
      ExpressionAttributeValues: { ':moviePrefix': 'MOVIE#' },
      ConsistentRead: true,
      ExclusiveStartKey: lastEvaluatedKey,
    }))
    result.push(...(page.Items as StoredMovie[] || []).map(({ pk: _pk, sk: _sk, ...movie }) => movie))
    lastEvaluatedKey = page.LastEvaluatedKey
  } while (lastEvaluatedKey)

  return result.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export async function getMovie(id: number) {
  if (!isDynamoConfigured()) {
    const [movie] = await (await getLocalDb())
      .select()
      .from(movies)
      .where(eq(movies.id, id))
      .limit(1)
    return movie ? fromSqliteMovie(movie) : null
  }

  const result = await getDynamoDocumentClient().send(new GetCommand({
    TableName: getDynamoTableName(),
    Key: { pk: `MOVIE#${id}`, sk: 'MOVIE' },
    ConsistentRead: true,
  }))
  if (!result.Item) return null
  const { pk: _pk, sk: _sk, ...movie } = result.Item as StoredMovie
  return movie
}

export async function createMovie(movie: NewMovie) {
  if (!isDynamoConfigured()) {
    try {
      const [created] = await (await getLocalDb())
        .insert(movies)
        .values({
          ...movie,
          genres: JSON.stringify(movie.genres),
        })
        .returning()
      if (!created) throw createError({ statusCode: 500, statusMessage: 'Movie could not be saved' })
      return fromSqliteMovie(created)
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new DuplicateMovieError()
      }
      throw error
    }
  }

  const client = getDynamoDocumentClient()
  const tableName = getDynamoTableName()
  const counter = await client.send(new UpdateCommand({
    TableName: tableName,
    Key: { pk: 'META', sk: 'MOVIE_ID' },
    UpdateExpression: 'ADD #value :one',
    ExpressionAttributeNames: { '#value': 'value' },
    ExpressionAttributeValues: { ':one': 1 },
    ReturnValues: 'UPDATED_NEW',
  }))
  const id = counter.Attributes?.value
  if (typeof id !== 'number') {
    throw createError({ statusCode: 500, statusMessage: 'Movie ID could not be allocated' })
  }

  const stored: StoredMovie = {
    ...movie,
    id,
    createdAt: new Date().toISOString(),
    pk: `MOVIE#${id}`,
    sk: 'MOVIE',
  }
  try {
    await client.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: stored,
            ConditionExpression: 'attribute_not_exists(pk)',
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              pk: `TMDB#${movie.mediaType}#${movie.tmdbId}`,
              sk: 'MOVIE',
              movieId: id,
            },
            ConditionExpression: 'attribute_not_exists(pk)',
          },
        },
      ],
    }))
  } catch (error) {
    if (error instanceof Error && error.name === 'TransactionCanceledException') {
      throw new DuplicateMovieError()
    }
    throw error
  }

  const { pk: _pk, sk: _sk, ...created } = stored
  return created
}

export async function updateMovie(id: number, updates: MovieChanges) {
  if (!isDynamoConfigured()) {
    const [updated] = await (await getLocalDb())
      .update(movies)
      .set(updates)
      .where(eq(movies.id, id))
      .returning()
    return updated ? fromSqliteMovie(updated) : null
  }

  const entries = Object.entries(updates)
  const expressionNames: Record<string, string> = {}
  const expressionValues: Record<string, unknown> = {}
  const assignments = entries.map(([field, value], index) => {
    const name = `#field${index}`
    const placeholder = `:value${index}`
    expressionNames[name] = field
    expressionValues[placeholder] = value
    return `${name} = ${placeholder}`
  })
  let result
  try {
    result = await getDynamoDocumentClient().send(new UpdateCommand({
      TableName: getDynamoTableName(),
      Key: { pk: `MOVIE#${id}`, sk: 'MOVIE' },
      UpdateExpression: `SET ${assignments.join(', ')}`,
      ConditionExpression: 'attribute_exists(pk)',
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ReturnValues: 'ALL_NEW',
    }))
  } catch (error) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') return null
    throw error
  }
  if (!result.Attributes) return null
  const { pk: _pk, sk: _sk, ...movie } = result.Attributes as StoredMovie
  return movie
}

export async function deleteMovie(id: number) {
  if (!isDynamoConfigured()) {
    const [deleted] = await (await getLocalDb())
      .delete(movies)
      .where(eq(movies.id, id))
      .returning({ id: movies.id })
    return deleted !== undefined
  }

  const movie = await getMovie(id)
  if (!movie) return false
  await getDynamoDocumentClient().send(new TransactWriteCommand({
    TransactItems: [
      { Delete: { TableName: getDynamoTableName(), Key: { pk: `MOVIE#${id}`, sk: 'MOVIE' } } },
      {
        Delete: {
          TableName: getDynamoTableName(),
          Key: { pk: `TMDB#${movie.mediaType}#${movie.tmdbId}`, sk: 'MOVIE' },
        },
      },
    ],
  }))
  return true
}
