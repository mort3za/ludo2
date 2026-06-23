import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { router } from "./router/index.js";
import { i18n } from "./shared/i18n";
import { applyLocaleToDocument } from "./shared/i18n/useLocale";
import { applyThemeToDocument } from "./shared/lib/use-theme";
import App from "./app/App.vue";
import "./styles/main.css";

applyLocaleToDocument(i18n.global.locale.value);
applyThemeToDocument();

const app = createApp(App);
app.use(createPinia());
app.use(VueQueryPlugin);
app.use(router);
app.use(i18n);
app.mount("#app");

// Register the service worker that caches background images. Production only,
// so dev hot-reload is never served from a stale cache.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
