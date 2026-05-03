<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";

const route = useRoute();
const isHome = computed(() => route.name === "home");
</script>

<template>
  <header v-if="!isHome" class="fixed top-0 inset-x-0 z-40 flex items-center px-4 py-2">
    <router-link
      to="/"
      class="text-body-sm font-sans text-subtle-gray hover:text-midnight-ink transition-colors"
    >
      ← Home
    </router-link>
  </header>
</template>
