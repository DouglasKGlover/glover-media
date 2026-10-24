import { readArchiveSession, verifyCsrfRequest } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (path.startsWith('/_nuxt/') || path.startsWith('/api/auth/')
    || path === '/favicon.ico' || path === '/robots.txt') {
    return
  }

  const apiRequest = path === '/api' || path.startsWith('/api/')
  if (!apiRequest) return

  const publicRead = event.method === 'GET' || event.method === 'HEAD'
  const publicEndpoint = path === '/api/movies'
    || /^\/api\/movies\/\d+$/.test(path)
    || path === '/api/auth/session'
  if (publicRead && publicEndpoint) return

  const session = await readArchiveSession(event)
  if (session) {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.method)) {
      verifyCsrfRequest(event, session.csrfToken)
    }
    return
  }

  throw createError({ statusCode: 401, statusMessage: 'Owner login required' })
})
