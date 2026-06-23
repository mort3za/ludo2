<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { usePlayerName, PLAYER_NAME_MAX } from "@/shared/lib/use-player-name";
import DInput from "./DInput.vue";

const { t } = useI18n();
const { playerName, setName } = usePlayerName();

const popover = ref<HTMLElement | null>(null);
const draft = ref("");
const showError = ref(false);

function open() {
  draft.value = playerName.value;
  showError.value = false;
  popover.value?.showPopover();
}

function close() {
  popover.value?.hidePopover();
}

function save() {
  if (!setName(draft.value)) {
    showError.value = true;
    return;
  }
  close();
}
</script>

<template>
  <button
    type="button"
    class="player-name-trigger d-btn d-btn--tertiary flex items-center gap-1.5 max-w-40"
    :title="t('playerName.edit')"
    :aria-label="t('playerName.edit')"
    data-testid="player-name-btn"
    @click="open"
  >
    <span class="truncate">{{ playerName }}</span>
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="shrink-0"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  </button>

  <div
    ref="popover"
    popover="auto"
    class="player-name-popover rounded-card bg-surface-card text-text-primary p-4 border border-border"
  >
    <form class="flex flex-col gap-3" @submit.prevent="save">
      <h2 class="text-body font-sans font-semibold">{{ t("playerName.title") }}</h2>
      <DInput
        v-model="draft"
        :placeholder="t('playerName.placeholder')"
        :maxlength="PLAYER_NAME_MAX"
        autofocus
        data-testid="player-name-input"
      />
      <p v-if="showError" class="text-caption text-danger font-sans">
        {{ t("playerName.errorLength") }}
      </p>
      <div class="flex justify-end gap-2 mt-1">
        <button type="button" class="d-btn d-btn--tertiary" @click="close">
          {{ t("playerName.cancel") }}
        </button>
        <button type="submit" class="d-btn d-btn--primary" data-testid="player-name-save">
          {{ t("playerName.save") }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.player-name-trigger {
  anchor-name: --player-name-anchor;
}

/* Anchor the popover under the trigger, extending toward the inline-start edge
   (left in LTR, right in RTL) so it tucks beneath the button on both. */
.player-name-popover {
  position: fixed;
  position-anchor: --player-name-anchor;
  position-area: block-end span-inline-start;
  margin: 0;
  margin-block-start: 0.5rem;
  width: 18rem;
  max-width: 90vw;
}
</style>
