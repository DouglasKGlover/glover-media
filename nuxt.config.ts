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
    dynamodbTableName: process.env.DYNAMODB_TABLE_NAME || '',
    catalogEventBusName: process.env.CATALOG_EVENT_BUS_NAME || '',
    publicSiteOrigin: process.env.PUBLIC_SITE_ORIGIN || '',
    apiBaseUrl: process.env.API_BASE_URL || '',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  nitro: {
    preset: process.env.NITRO_PRESET || undefined,
    prerender: {
      routes: [
        '/',
        '/collection',
        '/login',
        ...(process.env.STATIC_MOVIE_IDS || '')
          .split(',')
          .filter(id => /^\d+$/.test(id))
          .map(id => `/movie/${id}`),
      ],
      crawlLinks: true,
      failOnError: true,
    },
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
