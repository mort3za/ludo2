import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { SUPPORTED_LOCALES, LOCALE_STORAGE_KEY, type LocaleCode } from "./index";

const RTL_LOCALES: readonly LocaleCode[] = ["fa"];

export type Direction = "rtl" | "ltr";

export function dirFor(locale: string): Direction {
  return (RTL_LOCALES as readonly string[]).includes(locale) ? "rtl" : "ltr";
}

/** Apply `lang`/`dir` to `<html>`. Safe to call before mount. */
export function applyLocaleToDocument(locale: string): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = dirFor(locale);
}

/** Current locale, layout direction, and a persisting `setLocale`. */
export function useLocale() {
  const { locale } = useI18n();
  const dir = computed<Direction>(() => dirFor(locale.value));

  function setLocale(code: LocaleCode): void {
    locale.value = code;
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
    applyLocaleToDocument(code);
  }

  return { locale, dir, availableLocales: SUPPORTED_LOCALES, setLocale };
}
