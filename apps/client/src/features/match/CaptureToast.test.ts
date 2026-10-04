import { createApp, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerColor } from "@ludo/shared";
import { createI18n } from "vue-i18n";
import en from "@/shared/i18n/locales/en.json";
import CaptureToast from "./CaptureToast.vue";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("CaptureToast", () => {
  it("shows again when the same color is captured a second time", async () => {
    vi.useFakeTimers();
    const capture = ref<{ color: PlayerColor } | undefined>(undefined);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp({ render: () => h(CaptureToast, { capture: capture.value }) });
    app.use(createI18n({ legacy: false, locale: "en", messages: { en } }));
    app.mount(host);

    capture.value = { color: "red" };
    await nextTick();
    expect(host.textContent).toContain("sent home");

    // Auto-dismiss after 3s, then let the leave transition finish.
    vi.advanceTimersByTime(3_000);
    await nextTick();
    vi.advanceTimersByTime(1_000);
    await nextTick();
    expect(host.textContent).not.toContain("sent home");

    // A second red capture is a new event and must show the toast again.
    capture.value = { color: "red" };
    await nextTick();
    expect(host.textContent).toContain("sent home");

    app.unmount();
  });
});
