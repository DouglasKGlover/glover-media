import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import type { H3Event } from 'h3'
import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { getDynamoDocumentClient, getDynamoTableName } from './dynamo'

const sessionCookie = 'glover-media-session'
const sessionLifetimeSeconds = 60 * 60 * 24 * 7
const loginWindowMs = 15 * 60 * 1000
const loginAttemptLimit = 5

interface SessionPayload {
  exp: number
  csrf: string
  sid: string
}

interface AuthConfig {
  username: string
  passwordHash: string
  secret: string
  secureCookie: boolean
}

function getAuthConfig(): AuthConfig {
  const config = useRuntimeConfig()
  const username = String(config.archiveUsername || '')
  const passwordHash = String(config.authPasswordHash || '')
  const secret = String(config.authSecret || '')

  if (!username || !passwordHash || secret.length < 32) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Archive login is not configured. Run npm run auth:setup and configure the generated secrets.',
    })
  }

  return {
    username,
    passwordHash,
    secret,
    secureCookie: process.env.NODE_ENV === 'production' || config.nodeEnv === 'production',
  }
}

function safeEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right)
}

function signature(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest()
}

function parsePasswordHash(value: string) {
  const [algorithm, nText, rText, pText, saltText, hashText, extra] = value.split('$')
  const n = Number(nText)
  const r = Number(rText)
  const p = Number(pText)
  const salt = Buffer.from(saltText || '', 'base64url')
  const hash = Buffer.from(hashText || '', 'base64url')

  if (extra !== undefined || algorithm !== 'scrypt'
    || n !== 32768 || r !== 8 || p !== 1
    || salt.length !== 16 || hash.length !== 64) {
    throw createError({
      statusCode: 503,
      statusMessage: 'AUTH_PASSWORD_HASH is invalid. Regenerate it with npm run auth:setup.',
    })
  }

  return { salt, hash }
}

export function verifyArchivePassword(password: string, expectedUsername: string, submittedUsername: string) {
  const config = getAuthConfig()
  const { salt, hash } = parsePasswordHash(config.passwordHash)
  const candidate = scryptSync(password, salt, hash.length, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })
  const usernameMatches = safeEqual(
    Buffer.from(submittedUsername),
    Buffer.from(expectedUsername),
  )
  const configuredUsernameMatches = safeEqual(
    Buffer.from(expectedUsername),
    Buffer.from(config.username),
  )

  return usernameMatches && configuredUsernameMatches && safeEqual(candidate, hash)
}

function signSession(payload: SessionPayload, secret: string) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${signature(encodedPayload, secret).toString('base64url')}`
}

export async function readArchiveSession(event: H3Event) {
  const token = getCookie(event, sessionCookie)
  if (!token) return null

  const config = getAuthConfig()
  const [encodedPayload, encodedSignature, extra] = token.split('.')
  if (!encodedPayload || !encodedSignature || extra !== undefined) return null

  const receivedSignature = Buffer.from(encodedSignature, 'base64url')
  if (!safeEqual(receivedSignature, signature(encodedPayload, config.secret))) return null

  let payload: Partial<SessionPayload>
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<SessionPayload>
  } catch {
    return null
  }

  if (!Number.isInteger(payload.exp) || (payload.exp ?? 0) <= Date.now() / 1000
    || typeof payload.sid !== 'string' || !/^[a-f0-9]{64}$/.test(payload.sid)
    || typeof payload.csrf !== 'string' || !/^[a-f0-9]{64}$/.test(payload.csrf)) {
    return null
  }

  const result = await getDynamoDocumentClient().send(new GetCommand({
    TableName: getDynamoTableName(),
    Key: { pk: `SESSION#${payload.sid}`, sk: 'SESSION' },
  }))
  return result.Item && typeof result.Item.expiresAt === 'number'
    && result.Item.expiresAt > Date.now() / 1000
    ? { id: payload.sid, csrfToken: payload.csrf }
    : null
}

export async function requireArchiveSession(event: H3Event) {
  const session = await readArchiveSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Owner login required' })
  }
  return session
}

export function verifyCsrfRequest(event: H3Event, csrfToken: string) {
  const requestOrigin = getRequestHeader(event, 'origin')
  const requestHost = getRequestHeader(event, 'host')
  const viewerHost = getRequestHeader(event, 'x-glover-viewer-host')
  const forwardedProtocol = getRequestHeader(event, 'x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
  let originMatches = false

  const configuredOrigin = String(useRuntimeConfig().publicSiteOrigin || '')
  if (requestOrigin && configuredOrigin) {
    originMatches = requestOrigin === configuredOrigin
  } else if (requestOrigin && viewerHost) {
    try {
      const origin = new URL(requestOrigin)
      originMatches = origin.protocol === 'https:' && origin.host === viewerHost
    } catch {
      originMatches = false
    }
  } else if (requestOrigin && requestHost) {
    try {
      const origin = new URL(requestOrigin)
      const requestProtocol = forwardedProtocol
        ? `${forwardedProtocol}:`
        : getRequestURL(event).protocol
      originMatches = origin.host === requestHost && origin.protocol === requestProtocol
    } catch {
      originMatches = false
    }
  }

  const suppliedToken = getRequestHeader(event, 'x-csrf-token') || ''
  if (!originMatches || !safeEqual(Buffer.from(suppliedToken), Buffer.from(csrfToken))) {
    throw createError({ statusCode: 403, statusMessage: 'Request could not be verified' })
  }
}

export async function createArchiveSession(event: H3Event) {
  const config = getAuthConfig()
  const csrfToken = randomBytes(32).toString('hex')
  const sessionId = randomBytes(32).toString('hex')
  const expiresAt = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds
  await getDynamoDocumentClient().send(new PutCommand({
    TableName: getDynamoTableName(),
    Item: {
      pk: `SESSION#${sessionId}`,
      sk: 'SESSION',
      expiresAt,
    },
  }))
  const token = signSession({
    csrf: csrfToken,
    exp: expiresAt,
    sid: sessionId,
  }, config.secret)

  setCookie(event, sessionCookie, token, {
    httpOnly: true,
    secure: config.secureCookie,
    sameSite: 'strict',
    path: '/',
    maxAge: sessionLifetimeSeconds,
  })

  return csrfToken
}

export function clearArchiveSession(event: H3Event) {
  const config = getAuthConfig()
  deleteCookie(event, sessionCookie, {
    httpOnly: true,
    secure: config.secureCookie,
    sameSite: 'strict',
    path: '/',
  })
}

export async function revokeArchiveSession(sessionId: string) {
  await getDynamoDocumentClient().send(new DeleteCommand({
    TableName: getDynamoTableName(),
    Key: { pk: `SESSION#${sessionId}`, sk: 'SESSION' },
  }))
}

export function getArchiveUsername() {
  return getAuthConfig().username
}

export async function checkLoginRateLimit(event: H3Event) {
  const ip = getClientAddress(event)
  const now = Date.now()
  const window = Math.floor(now / loginWindowMs)
  const result = await getDynamoDocumentClient().send(new GetCommand({
    TableName: getDynamoTableName(),
    Key: loginAttemptKey(ip, window),
  }))
  const attemptCount = result.Item?.attempts
  if (typeof attemptCount === 'number' && attemptCount >= loginAttemptLimit) {
    event.node.res.setHeader('retry-after', String(Math.ceil(((window + 1) * loginWindowMs - now) / 1000)))
    throw createError({ statusCode: 429, statusMessage: 'Too many login attempts. Try again in 15 minutes.' })
  }
}

export async function recordLoginFailure(event: H3Event) {
  const ip = getClientAddress(event)
  const now = Date.now()
  const window = Math.floor(now / loginWindowMs)
  try {
    await getDynamoDocumentClient().send(new UpdateCommand({
      TableName: getDynamoTableName(),
      Key: loginAttemptKey(ip, window),
      UpdateExpression: 'SET #expiresAt = :expiresAt ADD #attempts :one',
      ConditionExpression: 'attribute_not_exists(#attempts) OR #attempts < :limit',
      ExpressionAttributeNames: {
        '#attempts': 'attempts',
        '#expiresAt': 'expiresAt',
      },
      ExpressionAttributeValues: {
        ':expiresAt': Math.floor(((window + 1) * loginWindowMs) / 1000),
        ':one': 1,
        ':limit': loginAttemptLimit,
      },
    }))
  } catch (error) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') return
    throw error
  }
}

export async function clearLoginFailures(event: H3Event) {
  const ip = getClientAddress(event)
  const window = Math.floor(Date.now() / loginWindowMs)
  await getDynamoDocumentClient().send(new DeleteCommand({
    TableName: getDynamoTableName(),
    Key: loginAttemptKey(ip, window),
  }))
}

function loginAttemptKey(ip: string, window: number) {
  const secret = getAuthConfig().secret
  const addressHash = createHmac('sha256', secret).update(ip).digest('hex')
  return {
    pk: `LOGIN#${addressHash}`,
    sk: `WINDOW#${window}`,
  }
}

function getClientAddress(event: H3Event) {
  return getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || event.node.req.socket?.remoteAddress
    || 'unknown'
}
