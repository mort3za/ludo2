<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { computed } from "vue";
import { useSessionStore } from "@/stores/session";

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const isHome = computed(() => route.name === "home");

function logout() {
  session.logout();
  router.push("/");
}
</script>

<template>
  <header v-if="!isHome" class="fixed top-0 inset-x-0 z-40 flex items-center px-4 py-2">
    <router-link to="/" class="d-btn d-btn--tertiary"> ← Home </router-link>
    <button
      v-if="session.isLoggedIn"
      class="ml-auto text-body-sm font-sans text-subtle-gray hover:text-midnight-ink transition-colors"
      @click="logout"
    >
      Log out
    </button>
  </header>
</template>
