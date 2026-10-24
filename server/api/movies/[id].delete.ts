import { eq } from 'drizzle-orm'
import { movies } from '../../database/schema'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid movie ID' })
  }

  const [deleted] = await getDb()
    .delete(movies)
    .where(eq(movies.id, id))
    .returning({ id: movies.id })

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Movie not found' })
  }

  return { success: true }
})
