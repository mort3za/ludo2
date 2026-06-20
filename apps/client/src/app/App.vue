<script setup lang="ts">
import AppHeader from "@/shared/ui/AppHeader.vue";
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <router-view />
  </div>
</template>
