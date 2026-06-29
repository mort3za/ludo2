<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { DCard } from "@/shared/ui";

const { t } = useI18n();

const version = __APP_VERSION__;
</script>

<template>
  <main class="flex-1 flex flex-col items-center p-4">
    <article class="w-full max-w-2xl flex flex-col gap-4 py-2">
      <DCard elevated class="p-4 flex flex-col gap-2">
        <h1 class="text-body font-sans font-medium text-text-primary">
          {{ t("about.title") }}
        </h1>
        <p class="text-body-sm font-sans text-text-primary">{{ t("about.description") }}</p>
        <dl class="text-body-sm font-sans text-text-primary flex flex-col gap-1 mt-1">
          <div class="flex gap-2">
            <dt class="font-medium">{{ t("about.versionLabel") }}:</dt>
            <dd class="font-mono">{{ version }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="font-medium">{{ t("about.developerLabel") }}:</dt>
            <dd>Morteza Ziyaeimehr</dd>
          </div>
        </dl>
      </DCard>

      <DCard elevated class="p-4 flex flex-col gap-2">
        <h2 class="text-body font-sans font-medium text-text-primary">
          {{ t("about.privacyTitle") }}
        </h2>
        <p class="text-body-sm font-sans text-text-primary">{{ t("about.privacy") }}</p>
      </DCard>
    </article>
  </main>
</template>
