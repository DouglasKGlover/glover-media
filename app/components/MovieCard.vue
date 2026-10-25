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
      <span v-if="movie.dougWatched || movie.gilWatched" class="watched-indicators">
        <span v-if="movie.dougWatched" class="watched-indicator" aria-label="Doug watched" title="Doug watched">D</span>
        <span v-if="movie.gilWatched" class="watched-indicator" aria-label="Gil watched" title="Gil watched">G</span>
      </span>
    </div>
    <div class="movie-card-info">
      <h3>{{ movie.title }}</h3>
      <p v-if="movie.mediaType === 'tv' || movie.releaseYear || movie.genres.length" class="movie-meta">
        <span v-if="movie.mediaType === 'tv'">TV</span>
        <span v-else-if="movie.releaseYear">{{ movie.releaseYear }}</span>
        <span v-if="movie.mediaType === 'tv' && movie.releaseYear">{{ movie.releaseYear }}</span>
        <span v-if="movie.genres.length">
          {{ movie.mediaType === 'tv' || movie.releaseYear ? '· ' : '' }}{{ movie.genres.slice(0, 2).join(' · ') }}
        </span>
      </p>
      <div class="movie-ownership">
        <span class="format-badge">{{ movie.format }}</span>
      </div>
    </div>
  </NuxtLink>
</template>
