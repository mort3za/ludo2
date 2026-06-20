<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { DCard } from "@/shared/ui";

const { t } = useI18n();

const REPO_URL = "https://github.com/mort3za/ludo2";
const ISSUES_URL = `${REPO_URL}/issues`;
const version = __APP_VERSION__;
</script>

<template>
  <main class="min-h-screen flex flex-col items-center p-4">
    <article class="w-full max-w-2xl flex flex-col gap-4 py-2">
      <h1 class="text-body-lg font-sans font-medium text-text-primary tracking-tight">
        {{ t("about.title") }}
      </h1>
      <p class="text-body-sm font-sans text-text-primary">{{ t("about.description") }}</p>

      <DCard elevated class="p-4 flex flex-col gap-2">
        <h2 class="text-body font-sans font-medium text-text-primary">
          {{ t("about.openSourceTitle") }}
        </h2>
        <p class="text-body-sm font-sans text-text-primary">{{ t("about.openSource") }}</p>
        <a
          :href="REPO_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="d-btn d-btn--ghost self-start"
          data-testid="repo-link"
        >
          {{ t("about.viewOnGithub") }}
        </a>
      </DCard>

      <DCard elevated class="p-4 flex flex-col gap-2">
        <h2 class="text-body font-sans font-medium text-text-primary">
          {{ t("about.issuesTitle") }}
        </h2>
        <p class="text-body-sm font-sans text-text-primary">{{ t("about.issues") }}</p>
        <a
          :href="ISSUES_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="d-btn d-btn--ghost self-start"
          data-testid="issues-link"
        >
          {{ t("about.reportIssue") }}
        </a>
      </DCard>

      <DCard elevated class="p-4 flex flex-col gap-2">
        <h2 class="text-body font-sans font-medium text-text-primary">
          {{ t("about.detailsTitle") }}
        </h2>
        <dl class="text-body-sm font-sans text-text-primary flex flex-col gap-1">
          <div class="flex gap-2">
            <dt class="font-medium">{{ t("about.versionLabel") }}:</dt>
            <dd class="font-mono">{{ version }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="font-medium">{{ t("about.builtWithLabel") }}:</dt>
            <dd>{{ t("about.builtWith") }}</dd>
          </div>
        </dl>
      </DCard>
    </article>
  </main>
</template>
