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
    :class="status === 'disconnected' ? 'bg-danger text-on-danger' : 'bg-warning text-on-warning'"
  >
    {{ status === "disconnected" ? t("connection.reconnecting") : t("connection.connecting") }}
  </div>
</template>
