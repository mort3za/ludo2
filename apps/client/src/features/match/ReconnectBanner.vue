<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { WsStatus } from "@/shared/lib/ws";

defineProps<{
  status: WsStatus;
}>();

const { t } = useI18n();

function reload() {
  globalThis.location.reload();
}
</script>

<template>
  <div
    v-if="status !== 'connected'"
    class="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-3 py-2 text-caption font-sans"
    :class="status === 'connecting' ? 'bg-warning text-on-warning' : 'bg-danger text-on-danger'"
  >
    <template v-if="status === 'failed'">
      <span>{{ t("connection.lost") }}</span>
      <button type="button" class="font-medium underline" @click="reload">
        {{ t("connection.reload") }}
      </button>
    </template>
    <template v-else>
      {{ status === "disconnected" ? t("connection.reconnecting") : t("connection.connecting") }}
    </template>
  </div>
</template>
