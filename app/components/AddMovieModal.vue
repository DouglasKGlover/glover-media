<script setup lang="ts">
import type { MediaType, MovieFormat, TmdbMovieDetails, TmdbSearchResult } from '~~/shared/types/movie'
import { movieFormats } from '~~/shared/types/movie'

const props = defineProps<{ open: boolean }>()
const { data: authSession } = useNuxtData<{ csrfToken?: string }>('auth-session')
const emit = defineEmits<{
  'update:open': [value: boolean]
  added: []
}>()

const query = ref('')
const mediaType = ref<MediaType>('movie')
const results = ref<TmdbSearchResult[]>([])
const selected = ref<TmdbMovieDetails | null>(null)
const format = ref<MovieFormat>('Blu-ray')
const edition = ref('')
const dougWatched = ref(false)
const gilWatched = ref(false)
const dougWouldWatchAgain = ref<boolean | null>(null)
const gilWouldWatchAgain = ref<boolean | null>(null)
const dougRating = ref<number | ''>('')
const gilRating = ref<number | ''>('')
const notes = ref('')
const searching = ref(false)
const loadingDetails = ref(false)
const saving = ref(false)
const errorMessage = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined

function updateDougWatched(watched: boolean) {
  dougWatched.value = watched
  if (!watched) dougWouldWatchAgain.value = null
}

function updateGilWatched(watched: boolean) {
  gilWatched.value = watched
  if (!watched) gilWouldWatchAgain.value = null
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    query.value = ''
    results.value = []
    selected.value = null
    dougWatched.value = false
    gilWatched.value = false
    dougWouldWatchAgain.value = null
    gilWouldWatchAgain.value = null
    dougRating.value = ''
    gilRating.value = ''
    errorMessage.value = ''
  }
})

watch([query, mediaType], ([value, selectedType]) => {
  clearTimeout(searchTimer)
  selected.value = null
  errorMessage.value = ''
  if (value.trim().length < 2) {
    results.value = []
    searching.value = false
    return
  }

  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      results.value = await $fetch<TmdbSearchResult[]>('/api/tmdb/search', {
        query: { q: value.trim(), type: selectedType },
      })
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Movie search failed.'
    } finally {
      searching.value = false
    }
  }, 300)
})

onBeforeUnmount(() => clearTimeout(searchTimer))

async function chooseMovie(movie: TmdbSearchResult) {
  loadingDetails.value = true
  errorMessage.value = ''
  try {
    selected.value = await $fetch<TmdbMovieDetails>(`/api/tmdb/details/${movie.id}`, {
      query: { type: movie.mediaType },
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Movie details could not be loaded.'
  } finally {
    loadingDetails.value = false
  }
}

async function addMovie() {
  if (!selected.value) return

  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/movies', {
      method: 'POST',
      headers: { 'x-csrf-token': authSession.value?.csrfToken || '' },
      body: {
        tmdbId: selected.value.id,
        mediaType: selected.value.mediaType,
        title: selected.value.title,
        releaseYear: selected.value.release_date
          ? Number(selected.value.release_date.slice(0, 4))
          : null,
        posterPath: selected.value.poster_path,
        overview: selected.value.overview,
        runtime: selected.value.runtime,
        genres: selected.value.genres.map(genre => genre.name),
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
    emit('added')
    emit('update:open', false)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The movie could not be added.'
  } finally {
    saving.value = false
  }
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="close">
      <section
        class="add-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-movie-title"
      >
        <div class="modal-heading">
          <div>
            <p class="eyebrow">OVERVIEW</p>
            <h2 id="add-movie-title">{{ selected ? 'ADD TITLE' : 'SEARCH TMDB' }}</h2>
          </div>
          <button class="icon-button" aria-label="Close dialog" @click="close">×</button>
        </div>

        <template v-if="!selected">
          <div class="media-type-toggle" role="group" aria-label="Type of title">
            <button
              class="filter-chip"
              :class="{ selected: mediaType === 'movie' }"
              :aria-pressed="mediaType === 'movie'"
              @click="mediaType = 'movie'"
            >
              Films
            </button>
            <button
              class="filter-chip"
              :class="{ selected: mediaType === 'tv' }"
              :aria-pressed="mediaType === 'tv'"
              @click="mediaType = 'tv'"
            >
              TV shows
            </button>
          </div>
          <label class="field-label" for="tmdb-search">Search TMDB</label>
          <div class="search-field">
            <span class="search-icon" aria-hidden="true" />
            <input
              id="tmdb-search"
              v-model="query"
              autofocus
              type="search"
              placeholder="Search by movie title..."
            >
            <span v-if="searching" class="search-status">Searching</span>
          </div>
          <p class="helper-text">Search for a film or TV show.</p>

          <div v-if="results.length" class="search-results">
            <button
              v-for="movie in results"
              :key="movie.id"
              class="search-result"
              @click="chooseMovie(movie)"
            >
              <img
                v-if="posterUrl(movie.poster_path)"
                :src="posterUrl(movie.poster_path)!"
                :alt="`${movie.title} poster`"
              >
              <span v-else class="result-placeholder">{{ movie.title.slice(0, 1) }}</span>
              <span class="result-copy">
                <strong>{{ movie.title }}</strong>
                <span v-if="movie.release_date">{{ movie.release_date.slice(0, 4) }}</span>
              </span>
              <span class="result-arrow">›</span>
            </button>
          </div>
          <p v-else-if="query.trim().length >= 2 && !searching && !errorMessage" class="empty-search">
            No films found. Try another title.
          </p>
        </template>

        <div v-else class="configuration">
          <div class="selected-movie">
            <img
              v-if="posterUrl(selected.poster_path)"
              :src="posterUrl(selected.poster_path)!"
              :alt="`${selected.title} poster`"
            >
            <span v-else class="result-placeholder">{{ selected.title.slice(0, 1) }}</span>
            <div>
              <h3>{{ selected.title }}</h3>
              <p v-if="selected.release_date || selected.runtime">
                <span v-if="selected.release_date">{{ selected.release_date.slice(0, 4) }}</span>
                <span v-if="selected.runtime">
                  {{ selected.release_date ? ' · ' : '' }}{{ selected.mediaType === 'tv' ? 'Avg. episode: ' : '' }}{{ selected.runtime }} min
                </span>
              </p>
            </div>
            <button class="text-button" @click="selected = null">Change</button>
          </div>
          <div class="form-grid">
            <label class="field-label">
              Format
              <select v-model="format">
                <option v-for="value in movieFormats" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
            <label class="field-label">
              Edition
              <input v-model="edition" type="text" placeholder="Optional edition name">
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
            <label v-if="dougWatched" class="field-label">
              <span>
                <strong>Doug would watch again</strong>
              </span>
              <select v-model="dougWouldWatchAgain">
                <option :value="null">Not selected</option>
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </label>
            <label v-if="gilWatched" class="field-label">
              <span>
                <strong>Gil would watch again</strong>
              </span>
              <select v-model="gilWouldWatchAgain">
                <option :value="null">Not selected</option>
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
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
              <textarea v-model="notes" rows="2" placeholder="Notes"/>
            </label>
          </div>
        </div>

        <p v-if="loadingDetails" class="helper-text">Loading film details…</p>
        <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
        <div class="modal-actions">
          <button v-if="selected" class="button button-secondary" :disabled="saving" @click="selected = null">
            Back to search
          </button>
          <span v-else />
          <button
            v-if="selected"
            class="button button-primary"
            :disabled="saving || loadingDetails"
            @click="addMovie"
          >
            {{ saving ? 'Adding…' : 'Add to collection' }}
          </button>
          <button v-else class="button button-secondary" @click="close">Cancel</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
