import { deleteMovie } from '../../utils/catalog'
import { publishCatalogChanged } from '../../utils/dynamo'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid movie ID' })
  }

  const deleted = await deleteMovie(id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Movie not found' })
  }

  await publishCatalogChanged()
  return { success: true }
})
