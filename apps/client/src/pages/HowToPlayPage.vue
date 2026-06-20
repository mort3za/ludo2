<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { DCard } from "@/shared/ui";

const { t, tm, rt } = useI18n();

const sectionKeys = [
  "objective",
  "setup",
  "turn",
  "movement",
  "capturing",
  "sixes",
  "winning",
  "options",
] as const;
</script>

<template>
  <main class="min-h-screen flex flex-col items-center p-4">
    <article class="w-full max-w-2xl flex flex-col gap-4 py-2">
      <h1 class="text-body-lg font-sans font-medium text-text-primary tracking-tight">
        {{ t("howto.title") }}
      </h1>
      <p class="text-body-sm font-sans text-text-primary">{{ t("howto.intro") }}</p>

      <DCard v-for="key in sectionKeys" :key="key" elevated class="p-4 flex flex-col gap-2">
        <h2 class="text-body font-sans font-medium text-text-primary">
          {{ t(`howto.sections.${key}.title`) }}
        </h2>
        <ul class="list-disc ps-5 flex flex-col gap-1">
          <li
            v-for="(item, i) in tm(`howto.sections.${key}.items`)"
            :key="i"
            class="text-body-sm font-sans text-text-primary"
          >
            {{ rt(item) }}
          </li>
        </ul>
      </DCard>
    </article>
  </main>
</template>
