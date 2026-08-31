import {
  createSessionBroadcast,
  type SessionBroadcastChannel,
  type SessionBroadcastMessage,
} from "./sessionBroadcast";

const SOURCE_A = "tab_source_a001";
const SOURCE_B = "tab_source_b001";

class FakeBroadcastChannel implements SessionBroadcastChannel {
  readonly messages: unknown[] = [];
  readonly listeners = new Set<(event: { data: unknown }) => void>();
  addCalls = 0;
  closeCalls = 0;
  removeCalls = 0;
  throwOnClose = false;
  throwOnPost = false;
  throwOnRemove = false;

  postMessage(message: unknown) {
    if (this.throwOnPost) throw new Error("private post failure");
    this.messages.push(message);
  }

  addEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ) {
    if (type !== "message") throw new Error(`Unexpected event type: ${type}`);
    this.addCalls += 1;
    this.listeners.add(listener);
  }

  removeEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ) {
    if (type !== "message") throw new Error(`Unexpected event type: ${type}`);
    this.removeCalls += 1;
    if (this.throwOnRemove) throw new Error("private remove failure");
    this.listeners.delete(listener);
  }

  close() {
    this.closeCalls += 1;
    if (this.throwOnClose) throw new Error("private close failure");
  }

  emit(data: unknown) {
    Array.from(this.listeners).forEach((listener) => listener({ data }));
  }
}

const message = (
  overrides: Partial<SessionBroadcastMessage> = {},
): SessionBroadcastMessage => ({
  version: 1,
  type: "session-transition",
  sourceId: SOURCE_B,
  sequence: 1,
  phase: "invalidate",
  ...overrides,
});

describe("createSessionBroadcast", () => {
  it("publishes an exact non-PII message with a monotonic local sequence", () => {
    const channel = new FakeBroadcastChannel();
    const channelFactory = vi.fn(() => channel);
    const broadcast = createSessionBroadcast({
      sourceId: SOURCE_A,
      channelFactory,
    });

    broadcast.publish("invalidate");
    broadcast.publish("revalidate");

    expect(channelFactory).toHaveBeenCalledWith("airbob-session-v1");
    expect(channel.messages).toEqual([
      {
        version: 1,
        type: "session-transition",
        sourceId: SOURCE_A,
        sequence: 1,
        phase: "invalidate",
      },
      {
        version: 1,
        type: "session-transition",
        sourceId: SOURCE_A,
        sequence: 2,
        phase: "revalidate",
      },
    ]);
    expect(Object.keys(channel.messages[0] as object).sort()).toEqual([
      "phase",
      "sequence",
      "sourceId",
      "type",
      "version",
    ]);
    expect(JSON.stringify(channel.messages)).not.toMatch(
      /subject|user|email|cookie|token|timestamp|createdAt/i,
    );
  });

  it("delivers valid remote transitions and ignores self, duplicate, and out-of-order messages", () => {
    const channel = new FakeBroadcastChannel();
    const broadcast = createSessionBroadcast({
      sourceId: SOURCE_A,
      channelFactory: () => channel,
    });
    const listener = vi.fn();
    broadcast.subscribe(listener);

    channel.emit(message({ sourceId: SOURCE_A }));
    channel.emit(message({ sequence: 2 }));
    channel.emit(message({ sequence: 2, phase: "revalidate" }));
    channel.emit(message({ sequence: 1 }));
    channel.emit(message({ sourceId: "tab_source_c001", sequence: 1 }));

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, message({ sequence: 2 }));
    expect(listener).toHaveBeenNthCalledWith(
      2,
      message({ sourceId: "tab_source_c001", sequence: 1 }),
    );
  });

  it.each([
    ["null", null],
    ["array", []],
    ["missing key", { version: 1, type: "session-transition" }],
    ["extra key", { ...message(), subject: "subject:must-not-pass" }],
    ["wrong version", message({ version: 2 as 1 })],
    ["wrong type", message({ type: "viewer-changed" as "session-transition" })],
    ["invalid source", message({ sourceId: "member@example.invalid" })],
    ["zero sequence", message({ sequence: 0 })],
    ["fractional sequence", message({ sequence: 1.5 })],
    ["unsafe sequence", message({ sequence: Number.MAX_SAFE_INTEGER + 1 })],
    ["wrong phase", message({ phase: "logout" as "invalidate" })],
  ])("ignores malformed payloads: %s", (_name, malformed) => {
    const channel = new FakeBroadcastChannel();
    const broadcast = createSessionBroadcast({
      sourceId: SOURCE_A,
      channelFactory: () => channel,
    });
    const listener = vi.fn();
    broadcast.subscribe(listener);

    channel.emit(malformed);
    channel.emit(message());

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(message());
  });

  it("isolates listener failures from the other subscribers", () => {
    const channel = new FakeBroadcastChannel();
    const broadcast = createSessionBroadcast({
      sourceId: SOURCE_A,
      channelFactory: () => channel,
    });
    const healthyListener = vi.fn();

    broadcast.subscribe(() => {
      throw new Error("private listener failure");
    });
    broadcast.subscribe(healthyListener);

    expect(() => channel.emit(message())).not.toThrow();
    expect(healthyListener).toHaveBeenCalledWith(message());
  });

  it("supports idempotent unsubscribe and close without retaining listeners", () => {
    const channel = new FakeBroadcastChannel();
    const broadcast = createSessionBroadcast({
      sourceId: SOURCE_A,
      channelFactory: () => channel,
    });
    const listener = vi.fn();
    const unsubscribe = broadcast.subscribe(listener);

    unsubscribe();
    unsubscribe();
    channel.emit(message());
    broadcast.close();
    broadcast.close();
    channel.emit(message({ sequence: 2 }));

    expect(listener).not.toHaveBeenCalled();
    expect(channel.addCalls).toBe(1);
    expect(channel.removeCalls).toBe(1);
    expect(channel.closeCalls).toBe(1);
  });

  it("fails closed for unsupported channels, construction failures, and invalid source IDs", () => {
    const unsupported = createSessionBroadcast({
      sourceId: SOURCE_A,
      channelFactory: () => null,
    });
    const constructionFailure = createSessionBroadcast({
      sourceId: SOURCE_A,
      channelFactory: () => {
        throw new Error("private constructor failure");
      },
    });
    const channelFactory = vi.fn(() => new FakeBroadcastChannel());
    const invalidSource = createSessionBroadcast({
      sourceId: "person@example.invalid",
      channelFactory,
    });

    [unsupported, constructionFailure, invalidSource].forEach((broadcast) => {
      expect(() => broadcast.publish("invalidate")).not.toThrow();
      expect(() => broadcast.subscribe(vi.fn())()).not.toThrow();
      expect(() => broadcast.close()).not.toThrow();
    });
    expect(channelFactory).not.toHaveBeenCalled();
  });

  it("contains post, detach, and close failures while closing only once", () => {
    const channel = new FakeBroadcastChannel();
    channel.throwOnPost = true;
    channel.throwOnRemove = true;
    channel.throwOnClose = true;
    const broadcast = createSessionBroadcast({
      sourceId: SOURCE_A,
      channelFactory: () => channel,
    });

    expect(() => broadcast.publish("invalidate")).not.toThrow();
    expect(() => broadcast.close()).not.toThrow();
    expect(() => broadcast.close()).not.toThrow();
    expect(channel.removeCalls).toBe(1);
    expect(channel.closeCalls).toBe(1);
  });

  it("allows a StrictMode-style replacement to own the only live subscription", () => {
    const firstChannel = new FakeBroadcastChannel();
    const firstBroadcast = createSessionBroadcast({
      sourceId: SOURCE_A,
      channelFactory: () => firstChannel,
    });
    const firstListener = vi.fn();
    firstBroadcast.subscribe(firstListener);
    firstBroadcast.close();

    const secondChannel = new FakeBroadcastChannel();
    const secondBroadcast = createSessionBroadcast({
      sourceId: SOURCE_A,
      channelFactory: () => secondChannel,
    });
    const secondListener = vi.fn();
    secondBroadcast.subscribe(secondListener);

    firstChannel.emit(message());
    secondChannel.emit(message());

    expect(firstListener).not.toHaveBeenCalled();
    expect(secondListener).toHaveBeenCalledTimes(1);
  });
});
