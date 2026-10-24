import { eq } from 'drizzle-orm'
import { movies } from '../../database/schema'
import { getDb } from '../../utils/db'
import { movieFormats } from '../../../shared/types/movie'

interface MovieUpdateBody {
  format?: string
  edition?: string | null
  watched?: boolean
  rating?: number | null
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
  if (body.watched !== undefined) {
    if (typeof body.watched !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'Watched must be a boolean' })
    }
    updates.watched = body.watched
  }
  if (body.rating !== undefined) {
    if (body.rating !== null && (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 10)) {
      throw createError({ statusCode: 400, statusMessage: 'Rating must be between 1 and 10' })
    }
    updates.rating = body.rating
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
