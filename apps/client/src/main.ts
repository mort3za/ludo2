import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { router } from "./router/index.js";
import { i18n } from "./shared/i18n";
import { applyLocaleToDocument } from "./shared/i18n/useLocale";
import App from "./app/App.vue";
import "./styles/main.css";

applyLocaleToDocument(i18n.global.locale.value);

const app = createApp(App);
app.use(createPinia());
app.use(VueQueryPlugin);
app.use(router);
app.use(i18n);
app.mount("#app");
