import { movies } from '../../database/schema'
import { getDb } from '../../utils/db'
import { movieFormats } from '../../../shared/types/movie'
import type { MediaType } from '../../../shared/types/movie'

interface NewMovieBody {
  tmdbId: number
  mediaType?: MediaType
  title: string
  releaseYear?: number | null
  posterPath?: string | null
  overview?: string | null
  runtime?: number | null
  genres?: string[]
  format: string
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
  const body = await readBody<NewMovieBody>(event)
  if (!Number.isInteger(body?.tmdbId) || body.tmdbId < 1
    || typeof body.title !== 'string' || !body.title.trim()
    || (body.mediaType !== undefined && body.mediaType !== 'movie' && body.mediaType !== 'tv')
    || (body.dougWatched !== undefined && typeof body.dougWatched !== 'boolean')
    || (body.gilWatched !== undefined && typeof body.gilWatched !== 'boolean')
    || (body.dougWouldWatchAgain !== undefined && typeof body.dougWouldWatchAgain !== 'boolean')
    || (body.gilWouldWatchAgain !== undefined && typeof body.gilWouldWatchAgain !== 'boolean')
    || !movieFormats.includes(body.format as typeof movieFormats[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid movie details' })
  }

  for (const [name, rating] of [['Doug', body.dougRating], ['Gil', body.gilRating]] as const) {
    if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) {
      throw createError({ statusCode: 400, statusMessage: `${name} rating must be between 1 and 10` })
    }
  }

  const values = {
    tmdbId: body.tmdbId,
    mediaType: body.mediaType ?? 'movie',
    title: body.title.trim(),
    releaseYear: body.releaseYear ?? null,
    posterPath: body.posterPath ?? null,
    overview: body.overview ?? null,
    runtime: body.runtime ?? null,
    genres: JSON.stringify(Array.isArray(body.genres) ? body.genres : []),
    format: body.format,
    edition: body.edition?.trim() || null,
    dougWatched: body.dougWatched ?? false,
    gilWatched: body.gilWatched ?? false,
    dougWouldWatchAgain: body.dougWouldWatchAgain ?? false,
    gilWouldWatchAgain: body.gilWouldWatchAgain ?? false,
    dougRating: body.dougRating ?? null,
    gilRating: body.gilRating ?? null,
    notes: body.notes?.trim() || null,
  }

  try {
    const [movie] = await getDb().insert(movies).values(values).returning()
    if (!movie) {
      throw createError({ statusCode: 500, statusMessage: 'Movie could not be saved' })
    }
    setResponseStatus(event, 201)
    return { ...movie, genres: JSON.parse(movie.genres) as string[] }
  } catch (error) {
    if (error instanceof Error && error.message.includes('movies.media_type, movies.tmdb_id')) {
      throw createError({ statusCode: 409, statusMessage: 'This title is already in the collection' })
    }
    throw error
  }
})
