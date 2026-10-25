import { movieFormats } from '../../../shared/types/movie'
import type { MediaType, MovieFormat } from '../../../shared/types/movie'
import { createMovie, DuplicateMovieError } from '../../utils/catalog'
import { publishCatalogChanged } from '../../utils/dynamo'

interface NewMovieBody {
  tmdbId: number
  mediaType?: MediaType
  title: string
  releaseYear?: number | null
  posterPath?: string | null
  overview?: string | null
  runtime?: number | null
  genres?: string[]
  format: MovieFormat
  edition?: string | null
  dougWatched?: boolean
  gilWatched?: boolean
  dougWouldWatchAgain?: boolean | null
  gilWouldWatchAgain?: boolean | null
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
    || (body.dougWouldWatchAgain != null && typeof body.dougWouldWatchAgain !== 'boolean')
    || (body.gilWouldWatchAgain != null && typeof body.gilWouldWatchAgain !== 'boolean')
    || (body.dougWouldWatchAgain != null && !body.dougWatched)
    || (body.gilWouldWatchAgain != null && !body.gilWatched)
    || !movieFormats.includes(body.format)) {
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
    genres: Array.isArray(body.genres) ? body.genres : [],
    format: body.format,
    edition: body.edition?.trim() || null,
    dougWatched: body.dougWatched ?? false,
    gilWatched: body.gilWatched ?? false,
    dougWouldWatchAgain: body.dougWouldWatchAgain ?? null,
    gilWouldWatchAgain: body.gilWouldWatchAgain ?? null,
    dougRating: body.dougRating ?? null,
    gilRating: body.gilRating ?? null,
    notes: body.notes?.trim() || null,
  }

  try {
    const movie = await createMovie(values)
    await publishCatalogChanged()
    setResponseStatus(event, 201)
    return movie
  } catch (error) {
    if (error instanceof DuplicateMovieError) {
      throw createError({ statusCode: 409, statusMessage: 'This title is already in the collection' })
    }
    throw error
  }
})
