<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { type LocaleCode } from "@/shared/i18n";
import { useLocale } from "@/shared/i18n/useLocale";

const { t } = useI18n();
const { locale, availableLocales, setLocale } = useLocale();

const localeLabels: Record<LocaleCode, string> = {
  en: "English",
  fa: "فارسی",
  de: "Deutsch",
  ar: "العربية",
  es: "Español",
  fr: "Français",
  hi: "हिन्दी",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  nl: "Nederlands",
  pt: "Português",
  ru: "Русский",
  tr: "Türkçe",
  zh: "中文",
};
</script>

<template>
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
</template>
