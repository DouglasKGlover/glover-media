import { updateMovie } from '../../utils/catalog'
import { movieFormats } from '../../../shared/types/movie'
import type { MovieFormat } from '../../../shared/types/movie'
import { publishCatalogChanged } from '../../utils/dynamo'

interface MovieUpdateBody {
  format?: MovieFormat
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

  const updates: Parameters<typeof updateMovie>[1] = {}
  if (body.format !== undefined) {
    if (!movieFormats.includes(body.format)) {
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
    if (!body.dougWatched) updates.dougWouldWatchAgain = false
  }
  if (body.gilWatched !== undefined) {
    if (typeof body.gilWatched !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'Gil watched must be a boolean' })
    }
    updates.gilWatched = body.gilWatched
    if (!body.gilWatched) updates.gilWouldWatchAgain = false
  }
  if (body.dougWouldWatchAgain !== undefined) {
    if (typeof body.dougWouldWatchAgain !== 'boolean'
      || (body.dougWouldWatchAgain && body.dougWatched === false)) {
      throw createError({ statusCode: 400, statusMessage: 'Doug would watch again must be a boolean' })
    }
    updates.dougWouldWatchAgain = body.dougWouldWatchAgain
  }
  if (body.gilWouldWatchAgain !== undefined) {
    if (typeof body.gilWouldWatchAgain !== 'boolean'
      || (body.gilWouldWatchAgain && body.gilWatched === false)) {
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

  const movie = await updateMovie(id, updates)

  if (!movie) {
    throw createError({ statusCode: 404, statusMessage: 'Movie not found' })
  }

  await publishCatalogChanged()
  return movie
})
