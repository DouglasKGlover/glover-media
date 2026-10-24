import { readArchiveSession, getArchiveUsername } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await readArchiveSession(event)
  if (!session) return { authenticated: false }

  return {
    authenticated: true,
    username: getArchiveUsername(),
    csrfToken: session.csrfToken,
  }
})
