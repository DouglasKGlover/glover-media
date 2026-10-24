export function getTmdbApiKey() {
  const { tmdbApiKey: configuredKey } = useRuntimeConfig()
  const tmdbApiKey = process.env.TMDB_API_KEY || configuredKey
  if (!tmdbApiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'TMDB_API_KEY is not configured',
    })
  }
  return tmdbApiKey
}

export function getTmdbImageUrl(path: string | null) {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : null
}
