import { computed, ref } from "vue";

/** User's theme choice; "system" follows the OS `prefers-color-scheme`. */
export type ThemeChoice = "system" | "light" | "dark";
/** The concrete theme actually applied to the document. */
export type ResolvedTheme = "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

const STORAGE_KEY = "ludo:theme";

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "system" || v === "light" || v === "dark") return v;
  } catch {
    /* ignore storage failures (private mode, etc.) */
  }
  return "system";
}

const media =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

/** Reactive mirror of the OS `prefers-color-scheme: dark` match. */
const systemDark = ref(media?.matches ?? false);

function resolve(choice: ThemeChoice): ResolvedTheme {
  if (choice === "system") return systemDark.value ? "dark" : "light";
  return choice;
}

/** Shared theme choice — one source of truth for the selector and the document. */
const choice = ref<ThemeChoice>(readChoice());

/** The concrete theme actually applied — reactive; tracks choice + OS scheme. */
export const resolvedTheme = computed<ResolvedTheme>(() => resolve(choice.value));

/** Apply the resolved theme to `<html data-theme>`. Safe to call before mount. */
export function applyThemeToDocument(c: ThemeChoice = choice.value): void {
  document.documentElement.dataset.theme = resolve(c);
}

// Re-apply when the OS scheme flips while we're following "system".
media?.addEventListener("change", (e) => {
  systemDark.value = e.matches;
  if (choice.value === "system") applyThemeToDocument();
});

/** Current theme choice and a persisting `setTheme`. */
export function useTheme() {
  function setTheme(next: ThemeChoice): void {
    choice.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore storage failures (private mode, etc.) */
    }
    applyThemeToDocument(next);
  }

  return { theme: choice, availableThemes: THEME_CHOICES, setTheme };
}
