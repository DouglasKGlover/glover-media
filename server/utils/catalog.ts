import {
  DeleteCommand,
  GetCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import type { Movie } from '../../shared/types/movie'
import { getDynamoDocumentClient, getDynamoTableName } from './dynamo'

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

export class DuplicateMovieError extends Error {
  constructor() {
    super('This title is already in the collection')
    this.name = 'DuplicateMovieError'
  }
}

export async function listMovies() {
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
