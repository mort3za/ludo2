<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSessionStore } from "@/stores/session";
import { type LocaleCode } from "@/shared/i18n";
import { useLocale } from "@/shared/i18n/useLocale";

const { t } = useI18n();
const { locale, dir, availableLocales, setLocale } = useLocale();
const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const isHome = computed(() => route.name === "home");

/** Back arrow points toward the page start, which flips under RTL. */
const backArrow = computed(() => (dir.value === "rtl" ? "→" : "←"));

const localeLabels: Record<LocaleCode, string> = {
  en: "EN",
  fa: "فارسی",
};

function logout() {
  session.logout();
  router.push("/");
}
</script>

<template>
  <header v-if="!isHome" class="flex items-center gap-3 px-4 py-2">
    <router-link to="/" class="d-btn d-btn--tertiary">{{ backArrow }} {{ t("nav.home") }}</router-link>

    <div class="ms-auto flex items-center gap-3">
      <div class="flex items-center gap-1 text-body-sm font-sans">
        <button
          v-for="code in availableLocales"
          :key="code"
          type="button"
          class="px-1.5 transition-colors"
          :class="
            locale === code ? 'text-midnight-ink font-medium' : 'text-subtle-gray hover:text-midnight-ink'
          "
          :aria-pressed="locale === code"
          @click="setLocale(code)"
        >
          {{ localeLabels[code] }}
        </button>
      </div>

      <button
        v-if="session.isLoggedIn"
        class="text-body-sm font-sans text-subtle-gray hover:text-midnight-ink transition-colors"
        @click="logout"
      >
        {{ t("nav.logout") }}
      </button>
    </div>
  </header>
</template>
