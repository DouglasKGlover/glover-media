import { listMovies } from '../../utils/catalog'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const recentLimit = Number(query.recent)
  const orderedMovies = await listMovies()
  const result = Number.isInteger(recentLimit) && recentLimit > 0
    ? orderedMovies.slice(0, Math.min(recentLimit, 100))
    : orderedMovies
  return result
})
