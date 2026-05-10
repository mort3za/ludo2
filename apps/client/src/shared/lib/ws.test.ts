import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWsConnection } from "./ws";

class MockWebSocket {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send() {}

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  disconnect() {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe("createWsConnection", () => {
  const realWebSocket = globalThis.WebSocket;
  const realLocation = globalThis.location;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { origin: "http://localhost:3000" } as Location,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.WebSocket = realWebSocket;
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: realLocation,
    });
  });

  it("ignores stale socket close events after a reconnect succeeds", async () => {
    const connection = createWsConnection("room-1", "token-1");

    const firstSocket = MockWebSocket.instances[0]!;
    firstSocket.open();
    await nextTick();
    expect(connection.status.value).toBe("connected");

    firstSocket.disconnect();
    await nextTick();
    expect(connection.status.value).toBe("disconnected");

    vi.advanceTimersByTime(1000);

    const secondSocket = MockWebSocket.instances[1]!;
    secondSocket.open();
    await nextTick();
    expect(connection.status.value).toBe("connected");

    firstSocket.disconnect();
    await nextTick();
    expect(connection.status.value).toBe("connected");

    vi.advanceTimersByTime(8000);
    expect(MockWebSocket.instances).toHaveLength(2);
  });
});
