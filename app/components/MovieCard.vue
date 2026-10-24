<script setup lang="ts">
import type { Movie } from '~~/shared/types/movie'

defineProps<{ movie: Movie }>()
</script>

<template>
  <NuxtLink :to="`/movie/${movie.id}`" class="movie-card">
    <div class="poster-frame">
      <img
        v-if="posterUrl(movie.posterPath)"
        :src="posterUrl(movie.posterPath)!"
        :alt="`${movie.title} poster`"
        loading="lazy"
      >
      <div v-else class="poster-placeholder"><span>{{ movie.title }}</span></div>
      <span class="crt-noise" aria-hidden="true" />
      <span v-if="movie.watched" class="watched-indicator" aria-label="Watched">✓</span>
    </div>
    <div class="movie-card-info">
      <h3>{{ movie.title }}</h3>
      <p class="movie-meta">
        {{ movie.mediaType === 'tv' ? 'TV' : movie.releaseYear || 'Year unknown' }}
        <span v-if="movie.mediaType === 'tv'">{{ movie.releaseYear || 'Year unknown' }}</span>
        <span v-if="movie.genres.length">· {{ movie.genres.slice(0, 2).join(' · ') }}</span>
      </p>
      <div class="movie-ownership">
        <span class="format-badge">{{ movie.format }}</span>
      </div>
    </div>
  </NuxtLink>
</template>
