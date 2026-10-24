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
const runtimeConfig = useRuntimeConfig()
const { data: movie, error, refresh } = await useFetch<Movie>(() => `/api/movies/${id.value}`, {
  key: `movie-${id.value}`,
  baseURL: import.meta.server ? runtimeConfig.apiBaseUrl : undefined,
})
useHead({
  title: computed(() => movie.value
    ? `Glover Media - Collection - ${movie.value.title}`
    : 'Glover Media - Collection'),
})

const format = ref<MovieFormat>('Blu-ray')
const edition = ref('')
const dougWatched = ref(false)
const gilWatched = ref(false)
const dougWouldWatchAgain = ref(false)
const gilWouldWatchAgain = ref(false)
const dougRating = ref<number | ''>('')
const gilRating = ref<number | ''>('')
const notes = ref('')
const saving = ref(false)
const feedback = ref('')
const saveError = ref('')

watch(movie, (value) => {
  if (!value) return
  format.value = value.format
  edition.value = value.edition || ''
  dougWatched.value = value.dougWatched
  gilWatched.value = value.gilWatched
  dougWouldWatchAgain.value = value.dougWouldWatchAgain
  gilWouldWatchAgain.value = value.gilWouldWatchAgain
  dougRating.value = value.dougRating ?? ''
  gilRating.value = value.gilRating ?? ''
  notes.value = value.notes || ''
}, { immediate: true })

function updateDougWatched(watched: boolean) {
  dougWatched.value = watched
  if (!watched) dougWouldWatchAgain.value = false
}

function updateGilWatched(watched: boolean) {
  gilWatched.value = watched
  if (!watched) gilWouldWatchAgain.value = false
}

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
        dougWatched: dougWatched.value,
        gilWatched: gilWatched.value,
        dougWouldWatchAgain: dougWouldWatchAgain.value,
        gilWouldWatchAgain: gilWouldWatchAgain.value,
        dougRating: dougRating.value === '' ? null : Number(dougRating.value),
        gilRating: gilRating.value === '' ? null : Number(gilRating.value),
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
            <div class="personal-details-divider field-full" role="separator" aria-label="Personal details" />
            <label class="field-label watched-toggle">
              <span>
                <strong>Doug watched</strong>
                <small>Doug has watched this title.</small>
              </span>
              <input :checked="dougWatched" type="checkbox" @change="updateDougWatched(!dougWatched)">
            </label>
            <label class="field-label watched-toggle">
              <span>
                <strong>Gil watched</strong>
                <small>Gil has watched this title.</small>
              </span>
              <input :checked="gilWatched" type="checkbox" @change="updateGilWatched(!gilWatched)">
            </label>
            <label v-if="dougWatched" class="field-label watched-toggle">
              <span>
                <strong>Doug would watch again</strong>
                <small>Doug would watch this title again.</small>
              </span>
              <input v-model="dougWouldWatchAgain" type="checkbox">
            </label>
            <label v-if="gilWatched" class="field-label watched-toggle">
              <span>
                <strong>Gil would watch again</strong>
                <small>Gil would watch this title again.</small>
              </span>
              <input v-model="gilWouldWatchAgain" type="checkbox">
            </label>
            <label v-if="dougWatched" class="field-label">
              Doug rating
              <select v-model="dougRating">
                <option value="">Not rated</option>
                <option v-for="value in 10" :key="value" :value="value">{{ value }} / 10</option>
              </select>
            </label>
            <label v-if="gilWatched" class="field-label">
              Gil rating
              <select v-model="gilRating">
                <option value="">Not rated</option>
                <option v-for="value in 10" :key="value" :value="value">{{ value }} / 10</option>
              </select>
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
            <div class="personal-details-divider" role="separator" aria-label="Personal details" />
            <div><dt>DOUG WATCHED</dt><dd>{{ movie.dougWatched ? 'Watched' : 'Not watched' }}</dd></div>
            <div><dt>GIL WATCHED</dt><dd>{{ movie.gilWatched ? 'Watched' : 'Not watched' }}</dd></div>
            <div v-if="movie.dougWatched"><dt>DOUG WOULD WATCH AGAIN</dt><dd>{{ movie.dougWouldWatchAgain ? 'Yes' : 'No' }}</dd></div>
            <div v-if="movie.gilWatched"><dt>GIL WOULD WATCH AGAIN</dt><dd>{{ movie.gilWouldWatchAgain ? 'Yes' : 'No' }}</dd></div>
            <div v-if="movie.dougWatched"><dt>DOUG RATING</dt><dd>{{ movie.dougRating ? `${movie.dougRating} / 10` : 'Not rated' }}</dd></div>
            <div v-if="movie.gilWatched"><dt>GIL RATING</dt><dd>{{ movie.gilRating ? `${movie.gilRating} / 10` : 'Not rated' }}</dd></div>
            <div v-if="movie.notes" class="public-notes"><dt>NOTES</dt><dd>{{ movie.notes }}</dd></div>
          </dl>
        </section>
      </section>
    </article>
    <div v-else class="loading-state">Opening the archive…</div>
  </div>
</template>
