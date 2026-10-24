<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
useHead({ title: 'Glover Media - Login' })

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const submitting = ref(false)

function safeRedirect(value: unknown) {
  if (value === '/' || value === '/collection') return value
  return typeof value === 'string' && /^\/movie\/\d+$/.test(value) ? value : '/'
}

async function login() {
  errorMessage.value = ''
  submitting.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    await refreshNuxtData('auth-session')
    await navigateTo(safeRedirect(route.query.redirect))
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Login failed. Check your username and password.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-card">
      <NuxtLink to="/" class="brand login-brand" aria-label="Glover Media">
        <span class="brand-name">GLOVER MEDIA</span>
      </NuxtLink>

      <div class="login-heading">
        <!-- <p class="eyebrow">SIGN-IN</p> -->
        <h1>SIGN-IN</h1>
      </div>

      <form class="login-form" @submit.prevent="login">
        <label class="field-label">
          Username
          <input v-model="username" autocomplete="username" name="username" required autofocus>
        </label>
        <label class="field-label">
          Password
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            name="password"
            required
          >
        </label>
        <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
        <button class="button button-primary login-submit" type="submit" :disabled="submitting">
          {{ submitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

    </section>
  </main>
</template>
