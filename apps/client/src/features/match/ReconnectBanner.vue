<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { WsStatus } from "@/shared/lib/ws";

defineProps<{
  status: WsStatus;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="status === 'disconnected' || status === 'connecting'"
    class="fixed top-0 inset-x-0 z-50 flex items-center justify-center py-2 text-caption font-sans"
    :class="
      status === 'disconnected' ? 'bg-red-500 text-canvas-white' : 'bg-yellow-400 text-midnight-ink'
    "
  >
    {{ status === "disconnected" ? t("connection.reconnecting") : t("connection.connecting") }}
  </div>
</template>
