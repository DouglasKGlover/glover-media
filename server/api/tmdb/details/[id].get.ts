import type { TmdbMovieDetails } from '../../../../shared/types/movie'
import { getTmdbApiKey } from '../../../utils/tmdb'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const mediaType = String(getQuery(event).type || 'movie')
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid TMDB movie ID' })
  }
  if (mediaType !== 'movie' && mediaType !== 'tv') {
    throw createError({ statusCode: 400, statusMessage: 'Type must be movie or tv' })
  }

  const details = await $fetch<{
    id: number
    title?: string
    name?: string
    release_date?: string
    first_air_date?: string
    poster_path: string | null
    overview: string
    runtime?: number | null
    episode_run_time?: number[]
    genres: Array<{ id: number; name: string }>
  }>(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}`, {
    query: { api_key: getTmdbApiKey() },
  })

  const result: TmdbMovieDetails = {
    id: details.id,
    title: details.title || details.name || '',
    release_date: details.release_date || details.first_air_date || '',
    poster_path: details.poster_path,
    overview: details.overview,
    runtime: details.runtime ?? details.episode_run_time?.[0] ?? null,
    genres: details.genres,
    mediaType,
  }
  return result
})
