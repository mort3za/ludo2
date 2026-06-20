<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { type LocaleCode } from "@/shared/i18n";
import { useLocale } from "@/shared/i18n/useLocale";

const { t } = useI18n();
const { locale, dir, availableLocales, setLocale } = useLocale();
const route = useRoute();
const isHome = computed(() => route.name === "home");

/** Back arrow points toward the page start, which flips under RTL. */
const backArrow = computed(() => (dir.value === "rtl" ? "→" : "←"));

const localeLabels: Record<LocaleCode, string> = {
  en: "English",
  fa: "فارسی",
  de: "Deutsch",
};
</script>

<template>
  <header v-if="!isHome" class="flex items-center gap-3 px-4 py-2">
    <router-link to="/" class="d-btn d-btn--tertiary">{{ backArrow }} {{ t("nav.home") }}</router-link>

    <div class="ms-auto flex items-center gap-3">
      <select
        class="d-btn d-btn--tertiary"
        :value="locale"
        :aria-label="t('nav.language')"
        @change="setLocale(($event.target as HTMLSelectElement).value as LocaleCode)"
      >
        <option v-for="code in availableLocales" :key="code" :value="code">
          {{ localeLabels[code] }}
        </option>
      </select>
    </div>
  </header>
</template>
