export const movieFormats = ['4K UHD', 'Blu-ray', 'DVD', 'Digital'] as const

export type MovieFormat = typeof movieFormats[number]
export type MediaType = 'movie' | 'tv'

export interface Movie {
  id: number
  tmdbId: number
  mediaType: MediaType
  title: string
  releaseYear: number | null
  posterPath: string | null
  overview: string | null
  runtime: number | null
  genres: string[]
  format: MovieFormat
  edition: string | null
  watched: boolean
  rating: number | null
  notes: string | null
  createdAt: string
}

export interface TmdbSearchResult {
  id: number
  title: string
  release_date: string
  poster_path: string | null
  overview: string
  mediaType: MediaType
}

export interface TmdbMovieDetails extends TmdbSearchResult {
  runtime: number | null
  genres: Array<{ id: number; name: string }>
}
