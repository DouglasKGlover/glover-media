import { desc } from 'drizzle-orm'
import { movies } from '../../database/schema'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const recentLimit = Number(query.recent)
  const db = getDb()
  const orderedMovies = db
    .select()
    .from(movies)
    .orderBy(desc(movies.createdAt))
  const result = Number.isInteger(recentLimit) && recentLimit > 0
    ? await orderedMovies.limit(Math.min(recentLimit, 100))
    : await orderedMovies

  return result.map((movie) => ({
    ...movie,
    genres: JSON.parse(movie.genres) as string[],
  }))
})
