import { randomBytes, scryptSync } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const input = createInterface({ input: stdin, output: stdout })
const username = (await input.question('Owner username [owner]: ')).trim() || 'owner'
input.close()

if (!/^[A-Za-z0-9._-]{1,64}$/.test(username)) {
  throw new Error('Username must contain only letters, numbers, dots, dashes, or underscores.')
}
if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
  throw new Error('Run npm run auth:setup from an interactive terminal.')
}

function readHidden(prompt) {
  stdout.write(prompt)
  stdin.setRawMode(true)
  stdin.resume()

  return new Promise((resolve, reject) => {
    let value = ''
    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') {
          cleanup()
          reject(new Error('Password setup cancelled.'))
          return
        }
        if (character === '\r' || character === '\n') {
          cleanup()
          stdout.write('\n')
          resolve(value)
          return
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1)
        } else {
          value += character
        }
      }
    }
    const cleanup = () => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
    }
    stdin.on('data', onData)
  })
}

const password = await readHidden('Archive password (at least 12 characters): ')
const confirmation = await readHidden('Confirm password: ')

if (password.length < 12) {
  throw new Error('Use a password with at least 12 characters.')
}
if (password !== confirmation) {
  throw new Error('Passwords do not match.')
}

const salt = randomBytes(16)
const hash = scryptSync(password, salt, 64, {
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
})
const passwordHash = [
  'scrypt',
  32768,
  8,
  1,
  salt.toString('base64url'),
  hash.toString('base64url'),
].join('$')
const authSecret = randomBytes(32).toString('base64url')

stdout.write('\nAdd these values to your private .env file and deployment secrets:\n')
stdout.write(`ARCHIVE_USERNAME='${username}'\n`)
stdout.write(`AUTH_PASSWORD_HASH='${passwordHash}'\n`)
stdout.write(`AUTH_SECRET='${authSecret}'\n`)
stdout.write('\nKeep AUTH_PASSWORD_HASH and AUTH_SECRET private. Do not commit .env.\n')
