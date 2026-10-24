import { eq } from 'drizzle-orm'
import { movies } from '../../database/schema'
import { getDb } from '../../utils/db'
import { movieFormats } from '../../../shared/types/movie'

interface MovieUpdateBody {
  format?: string
  edition?: string | null
  dougWatched?: boolean
  gilWatched?: boolean
  dougWouldWatchAgain?: boolean
  gilWouldWatchAgain?: boolean
  dougRating?: number | null
  gilRating?: number | null
  notes?: string | null
}

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid movie ID' })
  }

  const body = await readBody<MovieUpdateBody>(event)
  if (!body || Object.keys(body).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Provide at least one field to update' })
  }

  const updates: Partial<typeof movies.$inferInsert> = {}
  if (body.format !== undefined) {
    if (!movieFormats.includes(body.format as typeof movieFormats[number])) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid format' })
    }
    updates.format = body.format
  }
  if (body.edition !== undefined) {
    if (body.edition !== null && typeof body.edition !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Edition must be text' })
    }
    updates.edition = body.edition?.trim() || null
  }
  if (body.dougWatched !== undefined) {
    if (typeof body.dougWatched !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'Doug watched must be a boolean' })
    }
    updates.dougWatched = body.dougWatched
  }
  if (body.gilWatched !== undefined) {
    if (typeof body.gilWatched !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'Gil watched must be a boolean' })
    }
    updates.gilWatched = body.gilWatched
  }
  if (body.dougWouldWatchAgain !== undefined) {
    if (typeof body.dougWouldWatchAgain !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'Doug would watch again must be a boolean' })
    }
    updates.dougWouldWatchAgain = body.dougWouldWatchAgain
  }
  if (body.gilWouldWatchAgain !== undefined) {
    if (typeof body.gilWouldWatchAgain !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'Gil would watch again must be a boolean' })
    }
    updates.gilWouldWatchAgain = body.gilWouldWatchAgain
  }
  if (body.dougRating !== undefined) {
    if (body.dougRating !== null && (!Number.isInteger(body.dougRating) || body.dougRating < 1 || body.dougRating > 10)) {
      throw createError({ statusCode: 400, statusMessage: 'Doug rating must be between 1 and 10' })
    }
    updates.dougRating = body.dougRating
  }
  if (body.gilRating !== undefined) {
    if (body.gilRating !== null && (!Number.isInteger(body.gilRating) || body.gilRating < 1 || body.gilRating > 10)) {
      throw createError({ statusCode: 400, statusMessage: 'Gil rating must be between 1 and 10' })
    }
    updates.gilRating = body.gilRating
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Notes must be text' })
    }
    updates.notes = body.notes?.trim() || null
  }
  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No supported fields were provided' })
  }

  const [movie] = await getDb()
    .update(movies)
    .set(updates)
    .where(eq(movies.id, id))
    .returning()

  if (!movie) {
    throw createError({ statusCode: 404, statusMessage: 'Movie not found' })
  }

  return { ...movie, genres: JSON.parse(movie.genres) as string[] }
})
