import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  devtools: { enabled: true },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || './data/movies.db',
    tmdbApiKey: process.env.TMDB_API_KEY || '',
    archiveUsername: process.env.ARCHIVE_USERNAME || '',
    authPasswordHash: process.env.AUTH_PASSWORD_HASH || '',
    authSecret: process.env.AUTH_SECRET || '',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  compatibilityDate: '2026-10-24',
  app: {
    head: {
      title: 'Glover Media',
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      ],
      meta: [
        { name: 'theme-color', content: '#101217' },
      ],
    },
  },
})
