<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useLocale } from "@/shared/i18n/useLocale";
import { useSound } from "@/shared/lib/use-sound";
import LocaleSelect from "./LocaleSelect.vue";

const { t } = useI18n();
const { dir } = useLocale();
const { muted, toggleMuted } = useSound();
const route = useRoute();
const isHome = computed(() => route.name === "home");
/** Sound toggle is only meaningful on the board (game) page. */
const showSound = computed(() => route.name === "match");
/** Language switching is hidden on the board (game) page. */
const showLanguage = computed(() => route.name !== "match");

/** Back arrow points toward the page start, which flips under RTL. */
const backArrow = computed(() => (dir.value === "rtl" ? "→" : "←"));
</script>

<template>
  <header v-if="!isHome" class="flex items-center gap-3 px-4 py-2">
    <router-link to="/" class="d-btn d-btn--tertiary"
      >{{ backArrow }} {{ t("nav.home") }}</router-link
    >

    <div class="ms-auto flex items-center gap-3">
      <button
        v-if="showSound"
        type="button"
        class="d-btn d-btn--tertiary"
        :aria-label="t('nav.toggleSound')"
        :aria-pressed="!muted"
        :title="t('nav.toggleSound')"
        @click="toggleMuted"
      >
        <svg
          v-if="!muted"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
        <svg
          v-else
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      </button>
      <LocaleSelect v-if="showLanguage" />
    </div>
  </header>
</template>
