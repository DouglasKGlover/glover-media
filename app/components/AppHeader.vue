<script setup lang="ts">
const emit = defineEmits<{ 'add-movie': [] }>()
const { data: authSession } = useNuxtData<{
  authenticated: boolean
  username?: string
  csrfToken?: string
}>('auth-session')
const logoutError = ref('')

async function logout() {
  logoutError.value = ''
  try {
    await $fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': authSession.value?.csrfToken || '' },
    })
    clearNuxtData('auth-session')
    await navigateTo('/login')
  } catch (error) {
    logoutError.value = error instanceof Error ? error.message : 'Could not log out.'
  }
}
</script>

<template>
  <header class="site-header">
    <NuxtLink to="/" class="brand brand-wordmark" aria-label="Glover Media home">
      <span class="brand-name">GLOVER MEDIA</span>
    </NuxtLink>

    <nav class="desktop-nav" aria-label="Main navigation">
      <NuxtLink to="/collection" active-class="active">Collection</NuxtLink>
    </nav>

    <div class="header-actions">
      <button v-if="authSession?.authenticated" class="button button-primary" @click="emit('add-movie')">
        <span aria-hidden="true">+</span>
        Add title
      </button>
      <button v-if="authSession?.authenticated" class="logout-button" @click="logout">Log out</button>
      <NuxtLink v-else to="/login" class="owner-login-link">Login</NuxtLink>
    </div>
    <span v-if="logoutError" class="logout-error" role="alert">{{ logoutError }}</span>
  </header>
</template>
