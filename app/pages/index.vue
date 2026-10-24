<script setup lang="ts">
import type { Movie } from '~~/shared/types/movie'

definePageMeta({ layout: 'default' })

const search = ref('')
const runtimeConfig = useRuntimeConfig()
const { data: movies, pending } = await useFetch<Movie[]>('/api/movies?recent=8', {
  key: 'recent-movies',
  default: () => [],
  baseURL: import.meta.server ? runtimeConfig.apiBaseUrl : undefined,
})
const { data: allMovies } = await useFetch<Movie[]>('/api/movies', {
  key: 'collection-movies',
  default: () => [],
  baseURL: import.meta.server ? runtimeConfig.apiBaseUrl : undefined,
})
const matchingMovies = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return movies.value
  return allMovies.value.filter(movie => movie.title.toLowerCase().includes(term))
})
</script>

<template>
  <div class="page-shell home-page">
    <section class="home-intro">
      <div class="intro-copy">
        <p class="eyebrow">THE GLOVER COLLECTION</p>
        <h1>FILMS &amp; SHOWS.</h1>
        <p class="intro-description">A catalog of our physical collection of movies and television shows.</p>
      </div>
    </section>

    <section class="home-search">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Search</p>
          <h2>Find a title.</h2>
        </div>
        <NuxtLink to="/collection" class="text-link">View full collection <span aria-hidden="true">→</span></NuxtLink>
      </div>
      <label class="search-field collection-search">
        <span class="search-icon" aria-hidden="true" />
        <input v-model="search" type="search" aria-label="Search the collection" placeholder="Search titles...">
        <kbd>/</kbd>
      </label>
    </section>

    <section class="recent-section">
      <div class="section-heading">
        <div class="title-and-count">
          <h2>RECENTLY ADDED</h2>
          <span class="count-label">{{ allMovies.length }} {{ allMovies.length === 1 ? 'title' : 'titles' }}</span>
        </div>
      </div>

      <div v-if="pending" class="loading-state">Opening the archive…</div>
      <div v-else-if="matchingMovies.length" class="movie-grid recent-grid">
        <MovieCard v-for="movie in matchingMovies" :key="movie.id" :movie="movie" />
      </div>
      <div v-else class="empty-state">
        <span class="empty-mark" aria-hidden="true">✳</span>
        <h3>{{ search ? 'NO MATCHES.' : 'NOTHING YET.' }}</h3>
        <p>{{ search ? 'Try another title.' : 'My collection is empty.' }}</p>
        <NuxtLink v-if="search" to="/collection" class="button button-secondary">Browse collection</NuxtLink>
      </div>
    </section>
  </div>
</template>
