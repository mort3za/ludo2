<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useTheme, type ThemeChoice } from "@/shared/lib/use-theme";

const { t } = useI18n();
const { theme, availableThemes, setTheme } = useTheme();
</script>

<template>
  <select
    class="d-btn d-btn--tertiary"
    :value="theme"
    :aria-label="t('nav.theme')"
    @change="setTheme(($event.target as HTMLSelectElement).value as ThemeChoice)"
  >
    <option v-for="opt in availableThemes" :key="opt" :value="opt">
      {{ t(`nav.themes.${opt}`) }}
    </option>
  </select>
</template>
