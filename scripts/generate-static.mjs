import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const apiBaseUrl = (process.env.API_BASE_URL || process.env.NUXT_API_BASE_URL || '').replace(/\/+$/, '')
if (!apiBaseUrl) {
  throw new Error('Set API_BASE_URL to the deployed API Gateway base URL before generating the static site.')
}

const response = await fetch(`${apiBaseUrl}/api/movies`)
if (!response.ok) {
  throw new Error(`Could not load the public catalog for static generation (${response.status} ${response.statusText}).`)
}

const movies = await response.json()
if (!Array.isArray(movies) || movies.some(movie => !Number.isInteger(movie?.id) || movie.id < 1)) {
  throw new Error('The public catalog API returned an invalid movie list.')
}

const movieIds = [...new Set(movies.map(movie => movie.id))].sort((left, right) => left - right)
const env = {
  ...process.env,
  API_BASE_URL: apiBaseUrl,
  NUXT_API_BASE_URL: apiBaseUrl,
  STATIC_MOVIE_IDS: movieIds.join(','),
}
const nuxi = resolve('node_modules', '@nuxt', 'cli', 'bin', 'nuxi.mjs')
const result = spawnSync(process.execPath, [nuxi, 'generate'], {
  env,
  stdio: 'inherit',
})

if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
