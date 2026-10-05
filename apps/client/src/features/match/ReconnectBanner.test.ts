import { createApp, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WsStatus } from "@/shared/lib/ws";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const { default: ReconnectBanner } = await import("./ReconnectBanner.vue");

afterEach(() => {
  document.body.innerHTML = "";
});

function render(status: WsStatus): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  createApp({ render: () => h(ReconnectBanner, { status }) }).mount(host);
  return host;
}

describe("ReconnectBanner", () => {
  it("says it is reconnecting between attempts", () => {
    expect(render("disconnected").textContent).toContain("connection.reconnecting");
  });

  it("says the connection is lost — not 'reconnecting' — once retries ran out", () => {
    const host = render("failed");
    expect(host.textContent).toContain("connection.lost");
    expect(host.textContent).not.toContain("connection.reconnecting");
  });

  it("offers a reload once retries ran out", () => {
    const reload = vi.fn();
    const realLocation = globalThis.location;
    Object.defineProperty(globalThis, "location", { configurable: true, value: { reload } });
    try {
      const button = render("failed").querySelector("button")!;
      expect(button.textContent).toContain("connection.reload");
      button.click();
      expect(reload).toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, "location", { configurable: true, value: realLocation });
    }
  });

  it("shows nothing while connected", () => {
    expect(render("connected").textContent).toBe("");
  });
});
