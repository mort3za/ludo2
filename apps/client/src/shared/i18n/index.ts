import { createI18n } from "vue-i18n";
import en from "./locales/en.json";
import fa from "./locales/fa.json";
import de from "./locales/de.json";
import zh from "./locales/zh.json";
import es from "./locales/es.json";
import it from "./locales/it.json";
import pt from "./locales/pt.json";
import nl from "./locales/nl.json";
import hi from "./locales/hi.json";
import ar from "./locales/ar.json";
import fr from "./locales/fr.json";
import ru from "./locales/ru.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import tr from "./locales/tr.json";

export const SUPPORTED_LOCALES = [
  "en",
  "fa",
  "de",
  "ar",
  "es",
  "fr",
  "hi",
  "it",
  "ja",
  "ko",
  "nl",
  "pt",
  "ru",
  "tr",
  "zh",
] as const;
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

/** localStorage key for the persisted locale choice. */
export const LOCALE_STORAGE_KEY = "ludo:locale";

function isSupported(code: string | null | undefined): code is LocaleCode {
  return !!code && (SUPPORTED_LOCALES as readonly string[]).includes(code);
}

/** Persisted choice → browser language → `'en'`. */
export function resolveInitialLocale(): LocaleCode {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (isSupported(stored)) return stored;

  const browser = navigator.language?.slice(0, 2);
  if (isSupported(browser)) return browser;

  return "en";
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveInitialLocale(),
  fallbackLocale: "en",
  messages: { en, fa, de, zh, es, it, pt, nl, hi, ar, fr, ru, ja, ko, tr },
});

// For strings outside component setup (e.g. `.ts` modules), use `i18n.global.t`.
