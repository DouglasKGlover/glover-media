export function posterUrl(path: string | null) {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : null
}
