<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { DPill } from "@/shared/ui";

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <DPill>{{ t("spectator.badge") }}</DPill>
    <p class="text-body-sm text-text-muted font-sans">
      {{ t("spectator.description") }}
    </p>
  </div>
</template>
