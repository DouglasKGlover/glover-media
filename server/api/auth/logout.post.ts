import {
  clearArchiveSession,
  requireArchiveSession,
  revokeArchiveSession,
  verifyCsrfRequest,
} from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await requireArchiveSession(event)
  verifyCsrfRequest(event, session.csrfToken)
  await revokeArchiveSession(session.id)
  clearArchiveSession(event)
  return { authenticated: false }
})
