<script setup lang="ts">
import type { Movie } from '~~/shared/types/movie'
import { movieFormats } from '~~/shared/types/movie'

definePageMeta({ layout: 'default' })
useHead({ title: 'Glover Media - Collection' })

const search = ref('')
const format = ref('')
const watched = ref('')
const sort = ref('recent')
const { data: movies, pending } = await useFetch<Movie[]>('/api/movies', {
  key: 'collection-movies',
  default: () => [],
})

const filteredMovies = computed(() => {
  const term = search.value.trim().toLowerCase()
  const results = movies.value.filter((movie) => {
    const matchesSearch = !term || movie.title.toLowerCase().includes(term)
    const matchesFormat = !format.value || movie.format === format.value
    const matchesWatched = !watched.value
      || (watched.value === 'watched' ? movie.watched : !movie.watched)
    return matchesSearch && matchesFormat && matchesWatched
  })

  return results.sort((a, b) => {
    if (sort.value === 'year') return (b.releaseYear ?? 0) - (a.releaseYear ?? 0)
    if (sort.value === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
})
</script>

<template>
  <div class="page-shell collection-page">
    <section class="collection-title">
      <div>
        <p class="eyebrow">THE GLOVER COLLECTION</p>
        <h1>FILMS &amp; SHOWS</h1>
      </div>
      <div class="collection-total">
        <strong>{{ movies.length.toString().padStart(2, '0') }}</strong>
        <span>TITLES</span>
      </div>
    </section>

    <section class="collection-controls" aria-label="Collection search and filters">
      <label class="search-field collection-search">
        <span class="search-icon" aria-hidden="true" />
        <input v-model="search" type="search" aria-label="Search titles" placeholder="Search title...">
        <kbd>/</kbd>
      </label>
      <div class="filter-row">
        <button
          class="filter-chip"
          :class="{ selected: !format }"
          :aria-pressed="!format"
          @click="format = ''"
        >
          All formats
        </button>
        <button
          v-for="value in movieFormats"
          :key="value"
          class="filter-chip"
          :class="{ selected: format === value }"
          :aria-pressed="format === value"
          @click="format = format === value ? '' : value"
        >
          {{ value }}
        </button>
        <label class="select-control">
          <span class="sr-only">Filter by watched status</span>
          <select v-model="watched">
            <option value="">Any status</option>
            <option value="watched">Watched</option>
            <option value="unwatched">Unwatched</option>
          </select>
        </label>
        <label class="select-control sort-control">
          <span class="sr-only">Sort collection</span>
          <select v-model="sort">
            <option value="recent">Recently added</option>
            <option value="year">Release year</option>
            <option value="rating">Personal rating</option>
          </select>
        </label>
      </div>
    </section>

    <section class="collection-results">
      <div class="results-label">
        <h2>MY COLLECTION</h2>
        <span>SHOWING {{ filteredMovies.length }} OF {{ movies.length }} FILMS</span>
      </div>
      <div v-if="pending" class="loading-state">Opening the archive…</div>
      <div v-else-if="filteredMovies.length" class="movie-grid">
        <MovieCard v-for="movie in filteredMovies" :key="movie.id" :movie="movie" />
      </div>
      <div v-else class="empty-state">
        <span class="empty-mark" aria-hidden="true">✳</span>
        <h3>{{ movies.length ? 'NO MATCHES.' : 'NOTHING YET.' }}</h3>
        <p>{{ movies.length ? 'No titles match these filters.' : 'My collection is empty.' }}</p>
        <button v-if="movies.length" class="button button-secondary" @click="search = ''; format = ''; watched = ''">
          Clear filters
        </button>
      </div>
    </section>
  </div>
</template>
