<script setup lang="ts">
import AppHeader from "@/shared/ui/AppHeader.vue";
import AppBackground from "./AppBackground.vue";
</script>

<template>
  <AppBackground />
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <router-view />
  </div>
</template>
