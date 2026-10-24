import { getMovie } from '../../utils/catalog'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid movie ID' })
  }

  const movie = await getMovie(id)
  if (!movie) {
    throw createError({ statusCode: 404, statusMessage: 'Movie not found' })
  }
  return movie
})
