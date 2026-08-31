export type SessionBroadcastPhase = "invalidate" | "revalidate";

interface SessionBroadcastMessage {
  version: 1;
  type: "session-transition";
  sourceId: string;
  sequence: number;
  phase: SessionBroadcastPhase;
}

type SessionBroadcastListener = (message: SessionBroadcastMessage) => void;

interface SessionBroadcastChannel {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ): void;
  close(): void;
}

type SessionBroadcastChannelFactory = (
  channelName: string,
) => SessionBroadcastChannel | null;

export interface CreateSessionBroadcastOptions {
  sourceId?: string;
  channelFactory?: SessionBroadcastChannelFactory;
}

export interface SessionBroadcast {
  publish(phase: SessionBroadcastPhase): void;
  subscribe(listener: SessionBroadcastListener): () => void;
  close(): void;
}

const CHANNEL_NAME = "airbob-session-v1";
const MESSAGE_KEYS = [
  "version",
  "type",
  "sourceId",
  "sequence",
  "phase",
] as const;
const SOURCE_ID_PATTERN = /^tab_[A-Za-z0-9_-]{8,60}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactMessageKeys = (value: Record<string, unknown>) => {
  const keys = Object.keys(value);

  return (
    keys.length === MESSAGE_KEYS.length &&
    MESSAGE_KEYS.every((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    )
  );
};

const isSourceId = (value: unknown): value is string =>
  typeof value === "string" && SOURCE_ID_PATTERN.test(value);

const isPhase = (value: unknown): value is SessionBroadcastPhase =>
  value === "invalidate" || value === "revalidate";

const parseMessage = (value: unknown): SessionBroadcastMessage | null => {
  try {
    if (!isRecord(value) || !hasExactMessageKeys(value)) return null;
    if (value.version !== 1 || value.type !== "session-transition") return null;
    if (!isSourceId(value.sourceId)) return null;
    if (
      !Number.isSafeInteger(value.sequence) ||
      (value.sequence as number) < 1
    ) {
      return null;
    }
    if (!isPhase(value.phase)) return null;

    return Object.freeze({
      version: 1,
      type: "session-transition",
      sourceId: value.sourceId,
      sequence: value.sequence as number,
      phase: value.phase,
    });
  } catch {
    return null;
  }
};

const createRandomSourceId = (): string | null => {
  try {
    const browserCrypto = globalThis.crypto;
    const randomUuid = browserCrypto?.randomUUID?.();

    if (typeof randomUuid === "string") {
      const sourceId = `tab_${randomUuid}`;
      return isSourceId(sourceId) ? sourceId : null;
    }

    if (!browserCrypto?.getRandomValues) return null;

    const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
    const randomId = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const sourceId = `tab_${randomId}`;

    return isSourceId(sourceId) ? sourceId : null;
  } catch {
    return null;
  }
};

const defaultChannelFactory: SessionBroadcastChannelFactory = (channelName) => {
  if (typeof BroadcastChannel !== "function") return null;

  return new BroadcastChannel(
    channelName,
  ) as unknown as SessionBroadcastChannel;
};

const createInactiveBroadcast = (): SessionBroadcast => ({
  publish: () => undefined,
  subscribe: () => () => undefined,
  close: () => undefined,
});

export const createSessionBroadcast = ({
  sourceId = createRandomSourceId() ?? "",
  channelFactory = defaultChannelFactory,
}: CreateSessionBroadcastOptions = {}): SessionBroadcast => {
  if (!isSourceId(sourceId)) return createInactiveBroadcast();

  let channel: SessionBroadcastChannel | null;
  try {
    channel = channelFactory(CHANNEL_NAME);
  } catch {
    return createInactiveBroadcast();
  }
  if (channel === null) return createInactiveBroadcast();

  const listeners = new Set<SessionBroadcastListener>();
  const lastSeenSequenceBySource = new Map<string, number>();
  let closed = false;
  let localSequence = 0;

  const handleMessage = (event: { data: unknown }) => {
    if (closed) return;

    const received = parseMessage(event.data);
    if (received === null || received.sourceId === sourceId) return;

    const lastSeen = lastSeenSequenceBySource.get(received.sourceId) ?? 0;
    if (received.sequence <= lastSeen) return;

    lastSeenSequenceBySource.set(received.sourceId, received.sequence);
    Array.from(listeners).forEach((listener) => {
      try {
        listener(received);
      } catch {
        // One consumer must not prevent the other session owners from fencing.
      }
    });
  };

  try {
    channel.addEventListener("message", handleMessage);
  } catch {
    try {
      channel.close();
    } catch {
      // A failed channel is equivalent to an unsupported capability.
    }
    return createInactiveBroadcast();
  }

  return {
    publish: (phase) => {
      if (closed || !isPhase(phase)) return;
      if (localSequence >= Number.MAX_SAFE_INTEGER) return;

      localSequence += 1;
      const outgoing: SessionBroadcastMessage = Object.freeze({
        version: 1,
        type: "session-transition",
        sourceId,
        sequence: localSequence,
        phase,
      });

      try {
        channel?.postMessage(outgoing);
      } catch {
        // Cross-tab synchronization is advisory and cannot block local logout.
      }
    },
    subscribe: (listener) => {
      if (closed || typeof listener !== "function") return () => undefined;

      listeners.add(listener);
      let subscribed = true;

      return () => {
        if (!subscribed) return;

        subscribed = false;
        listeners.delete(listener);
      };
    },
    close: () => {
      if (closed) return;

      closed = true;
      listeners.clear();
      lastSeenSequenceBySource.clear();

      try {
        channel?.removeEventListener("message", handleMessage);
      } catch {
        // The closed flag still fences a listener retained by a failed detach.
      }

      try {
        channel?.close();
      } catch {
        // Closing must remain safe during StrictMode cleanup.
      }

      channel = null;
    },
  };
};
