import type { MediaType, TmdbSearchResult } from '../../../shared/types/movie'
import { getTmdbApiKey } from '../../utils/tmdb'

interface TmdbSearchResponse {
  results: Array<{
    id: number
    title?: string
    name?: string
    release_date?: string
    first_air_date?: string
    poster_path: string | null
    overview: string
  }>
}

export default defineEventHandler(async (event) => {
  const params = getQuery(event)
  const query = String(params.q || '').trim()
  const mediaType = String(params.type || 'movie') as MediaType
  if (!query) return []
  if (mediaType !== 'movie' && mediaType !== 'tv') {
    throw createError({ statusCode: 400, statusMessage: 'Type must be movie or tv' })
  }

  const endpoint = mediaType === 'tv'
    ? 'https://api.themoviedb.org/3/search/tv'
    : 'https://api.themoviedb.org/3/search/movie'
  const response = await $fetch<TmdbSearchResponse>(endpoint, {
    query: { api_key: getTmdbApiKey(), query, include_adult: false },
  })
  return response.results.slice(0, 10).map((result): TmdbSearchResult => ({
    id: result.id,
    title: result.title || result.name || '',
    release_date: result.release_date || result.first_air_date || '',
    poster_path: result.poster_path,
    overview: result.overview,
    mediaType,
  }))
})
