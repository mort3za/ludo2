<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { DButton, LocaleSelect } from "@/shared/ui";
import { guestLogin, createRoom } from "@/shared/api/client";
import { useSessionStore } from "@/stores/session";

const { t } = useI18n();
const router = useRouter();
const session = useSessionStore();
const loading = ref(false);
const error = ref("");

async function play() {
  error.value = "";
  loading.value = true;
  try {
    const auth = await guestLogin();
    session.login(auth.token, auth.playerId);
    const { roomId } = await createRoom();
    await router.push({ name: "room", params: { roomId } });
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("home.error");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="mt-0! min-h-screen flex flex-col">
    <header class="flex items-center px-4 py-2">
      <LocaleSelect class="ms-auto" />
    </header>

    <div class="flex-1 flex flex-col items-center justify-center gap-4">
      <h1 class="text-display font-sans text-midnight-ink tracking-tight mb-6">Ludo</h1>

      <DButton
        :disabled="loading"
        data-testid="play-btn"
        class="px-10 py-3 text-heading-sm min-w-40"
        @click="play"
      >
        {{ loading ? t("home.creating") : t("common.play") }}
      </DButton>
      <p v-if="error" class="text-caption text-red-500 font-sans text-center">{{ error }}</p>

      <nav class="mt-2 flex items-center gap-3">
        <router-link to="/how-to-play" class="d-btn d-btn--ghost" data-testid="how-to-play-btn">
          {{ t("common.howToPlay") }}
        </router-link>
        <router-link to="/about" class="d-btn d-btn--ghost" data-testid="about-btn">
          {{ t("common.about") }}
        </router-link>
      </nav>
    </div>
  </main>
</template>
