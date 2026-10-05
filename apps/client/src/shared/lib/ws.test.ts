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

  /** Fail the first socket and every reconnect attempt until the client gives up. */
  function exhaustReconnects() {
    MockWebSocket.instances[0]!.disconnect();
    for (let i = 0; i < 25; i++) {
      vi.advanceTimersByTime(15_000);
      MockWebSocket.instances.at(-1)!.disconnect();
    }
  }

  it("reports a failed connection once it stops retrying, not 'disconnected'", async () => {
    const connection = createWsConnection("room-1", "token-1");
    exhaustReconnects();
    const socketsBefore = MockWebSocket.instances.length;

    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances.length).toBe(socketsBefore); // really gave up
    expect(connection.status.value).toBe("failed");
    connection.close();
  });

  it("tries again when the network comes back after giving up", () => {
    const connection = createWsConnection("room-1", "token-1");
    exhaustReconnects();
    const socketsBefore = MockWebSocket.instances.length;

    window.dispatchEvent(new Event("online"));

    expect(MockWebSocket.instances.length).toBe(socketsBefore + 1);
    expect(connection.status.value).toBe("connecting");
    connection.close();
  });

  it("tries again when the tab becomes visible after giving up", () => {
    const connection = createWsConnection("room-1", "token-1");
    exhaustReconnects();
    const socketsBefore = MockWebSocket.instances.length;

    document.dispatchEvent(new Event("visibilitychange"));

    expect(MockWebSocket.instances.length).toBe(socketsBefore + 1);
    connection.close();
  });

  it("does not reconnect on network/visibility events after an intentional close", () => {
    const connection = createWsConnection("room-1", "token-1");
    exhaustReconnects();
    connection.close();
    const socketsBefore = MockWebSocket.instances.length;

    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));

    expect(MockWebSocket.instances.length).toBe(socketsBefore);
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
