<script setup lang="ts">
import type { Movie, MovieFormat } from '~~/shared/types/movie'
import { movieFormats } from '~~/shared/types/movie'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data: authSession } = useNuxtData<{
  authenticated: boolean
  csrfToken?: string
}>('auth-session')
const canEdit = computed(() => Boolean(authSession.value?.authenticated))
const { data: movie, error, refresh } = await useFetch<Movie>(() => `/api/movies/${id.value}`, {
  key: `movie-${id.value}`,
})
useHead({
  title: computed(() => movie.value
    ? `Glover Media - Collection - ${movie.value.title}`
    : 'Glover Media - Collection'),
})

const format = ref<MovieFormat>('Blu-ray')
const edition = ref('')
const watched = ref(false)
const rating = ref<number | ''>('')
const notes = ref('')
const saving = ref(false)
const feedback = ref('')
const saveError = ref('')

watch(movie, (value) => {
  if (!value) return
  format.value = value.format
  edition.value = value.edition || ''
  watched.value = value.watched
  rating.value = value.rating ?? ''
  notes.value = value.notes || ''
}, { immediate: true })

async function saveChanges() {
  saving.value = true
  feedback.value = ''
  saveError.value = ''
  try {
    await $fetch(`/api/movies/${id.value}`, {
      method: 'PATCH',
      headers: { 'x-csrf-token': authSession.value?.csrfToken || '' },
      body: {
        format: format.value,
        edition: edition.value,
        watched: watched.value,
        rating: rating.value === '' ? null : Number(rating.value),
        notes: notes.value,
      },
    })
    await refresh()
    await refreshNuxtData('collection-movies')
    await refreshNuxtData('recent-movies')
    feedback.value = 'Changes saved.'
  } catch (cause) {
    saveError.value = cause instanceof Error ? cause.message : 'Changes could not be saved.'
  } finally {
    saving.value = false
  }
}

async function removeMovie() {
  if (!movie.value || !window.confirm(`Remove “${movie.value.title}” from my collection?`)) return

  saveError.value = ''
  try {
    await $fetch(`/api/movies/${id.value}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': authSession.value?.csrfToken || '' },
    })
    await refreshNuxtData()
    await navigateTo('/collection')
  } catch (cause) {
    saveError.value = cause instanceof Error ? cause.message : 'The movie could not be removed.'
  }
}
</script>

<template>
  <div class="page-shell detail-page">
    <NuxtLink to="/collection" class="back-link"><span aria-hidden="true">←</span> Collection</NuxtLink>

    <div v-if="error" class="detail-error" role="alert">
      <h1>FILM NOT FOUND.</h1>
      <p>This title is no longer in the collection.</p>
      <NuxtLink to="/collection" class="button button-secondary">Back to collection</NuxtLink>
    </div>

    <article v-else-if="movie" class="detail-layout">
      <aside class="film-reference">
        <div class="detail-poster poster-frame">
          <img
            v-if="posterUrl(movie.posterPath)"
            :src="posterUrl(movie.posterPath)!"
            :alt="`${movie.title} poster`"
          >
          <div v-else class="poster-placeholder"><span>{{ movie.title }}</span></div>
        </div>
        <p class="eyebrow">ABOUT THE FILM</p>
        <div class="film-facts">
          <div>
            <span>RELEASE YEAR</span>
            <strong>{{ movie.releaseYear || 'Unknown' }}</strong>
          </div>
          <div>
            <span>RUNTIME</span>
            <strong>{{ movie.runtime ? `${movie.runtime} minutes` : 'Not listed' }}</strong>
          </div>
          <div>
            <span>GENRES</span>
            <strong>{{ movie.genres.length ? movie.genres.join(' · ') : 'Not listed' }}</strong>
          </div>
        </div>
      </aside>

      <section class="film-details">
        <div class="film-heading">
          <p class="eyebrow">{{ movie.mediaType === 'tv' ? 'TV SHOW' : 'FILM' }} / {{ movie.releaseYear || 'YEAR UNKNOWN' }}</p>
          <h1>{{ movie.title }}</h1>
          <p v-if="movie.overview" class="film-overview">{{ movie.overview }}</p>
        </div>

        <form v-if="canEdit" class="catalog-form panel" @submit.prevent="saveChanges">
          <div class="panel-heading">
            <div>
              <h2>PHYSICAL COPY DETAILS</h2>
            </div>
            <span class="format-badge">{{ movie.format }}</span>
          </div>
          <div class="detail-form-grid">
            <label class="field-label">
              Format
              <select v-model="format">
                <option v-for="value in movieFormats" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
            <label class="field-label">
              Edition
              <input v-model="edition" type="text" placeholder="e.g. Collector's edition">
            </label>
            <label class="field-label">
              Personal rating
              <select v-model="rating">
                <option value="">Not rated</option>
                <option v-for="value in 10" :key="value" :value="value">{{ value }} / 10</option>
              </select>
            </label>
            <label class="field-label field-full watched-toggle">
              <span>
                <strong>Watched</strong>
                <small>Mark this title as watched.</small>
              </span>
              <input v-model="watched" type="checkbox">
            </label>
            <label class="field-label field-full">
              Notes
              <textarea v-model="notes" rows="4" placeholder="Keep a note about this copy..."/>
            </label>
          </div>
          <p v-if="feedback" class="success-message" role="status">{{ feedback }}</p>
          <p v-if="saveError" class="error-message" role="alert">{{ saveError }}</p>
          <div class="form-actions">
            <button class="button button-primary" type="submit" :disabled="saving">
              {{ saving ? 'Saving…' : 'Save changes' }}
            </button>
            <button class="text-button danger-text" type="button" @click="removeMovie">Remove from collection</button>
          </div>
        </form>
        <section v-else class="catalog-form panel">
          <div class="panel-heading">
            <div>
              <h2>PHYSICAL COPY DETAILS</h2>
            </div>
            <span class="format-badge">{{ movie.format }}</span>
          </div>
          <dl class="public-copy-details">
            <div><dt>EDITION</dt><dd>{{ movie.edition || 'Not specified' }}</dd></div>
            <div><dt>WATCHED</dt><dd>{{ movie.watched ? 'Watched' : 'Not watched' }}</dd></div>
            <div><dt>PERSONAL RATING</dt><dd>{{ movie.rating ? `${movie.rating} / 10` : 'Not rated' }}</dd></div>
            <div v-if="movie.notes" class="public-notes"><dt>NOTES</dt><dd>{{ movie.notes }}</dd></div>
          </dl>
        </section>
      </section>
    </article>
    <div v-else class="loading-state">Opening the archive…</div>
  </div>
</template>
