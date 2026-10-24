<script setup lang="ts">
import AppHeader from '~/components/AppHeader.vue'
import AddMovieModal from '~/components/AddMovieModal.vue'

const isAddMovieOpen = ref(false)
const { data: authSession } = await useFetch<{
  authenticated: boolean
  username?: string
  csrfToken?: string
}>('/api/auth/session', { key: 'auth-session' })

function handleShortcut(event: KeyboardEvent) {
  if (authSession.value?.authenticated
    && (event.metaKey || event.ctrlKey)
    && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    isAddMovieOpen.value = true
  }
}

onMounted(() => window.addEventListener('keydown', handleShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', handleShortcut))
</script>

<template>
  <div class="min-h-screen">
    <AppHeader @add-movie="isAddMovieOpen = true" />
    <main>
      <slot />
    </main>
    <AddMovieModal
      v-if="authSession?.authenticated"
      v-model:open="isAddMovieOpen"
      @added="refreshNuxtData()"
    />
  </div>
</template>
