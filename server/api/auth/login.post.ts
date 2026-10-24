import {
  checkLoginRateLimit,
  clearLoginFailures,
  createArchiveSession,
  getArchiveUsername,
  recordLoginFailure,
  verifyArchivePassword,
} from '../../utils/auth'

interface LoginBody {
  username?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  await checkLoginRateLimit(event)
  const body = await readBody<LoginBody>(event)
  const username = typeof body?.username === 'string' ? body.username : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (password.length > 1024 || username.length > 128) {
    await recordLoginFailure(event)
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })
  }

  const archiveUsername = getArchiveUsername()
  const valid = verifyArchivePassword(password, archiveUsername, username)
  if (!valid) {
    await recordLoginFailure(event)
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })
  }

  await clearLoginFailures(event)
  const csrfToken = await createArchiveSession(event)
  return {
    authenticated: true,
    username,
    csrfToken,
  }
})
