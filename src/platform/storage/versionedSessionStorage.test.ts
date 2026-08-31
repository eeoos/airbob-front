import { createSessionStorageDriver } from "./sessionStorageDriverCore";
import { createVersionedSessionStorage } from "./versionedSessionStorage";

interface CheckoutRecord {
  reservationUid: string;
  amount: number;
}

const ownerA = "subject:viewer_a";
const ownerB = "subject:viewer_b";

const createStorage = (entries: Record<string, string> = {}): Storage => {
  const values = new Map(Object.entries(entries));

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

const isCheckoutRecord = (value: unknown): value is CheckoutRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.reservationUid === "string" &&
    typeof record.amount === "number" &&
    Number.isFinite(record.amount)
  );
};

const createRepository = ({
  storage = createStorage(),
  now = () => 1_000,
}: {
  storage?: Storage;
  now?: () => number;
} = {}) => ({
  storage,
  repository: createVersionedSessionStorage<CheckoutRecord>({
    namespace: "airbob:checkout-v1",
    slot: "handoff",
    purpose: "reservation-checkout",
    version: 1,
    privacyClass: "personal",
    containsPii: false,
    ttlMs: 5_000,
    dataKeys: ["reservationUid", "amount"],
    validateData: isCheckoutRecord,
    driver: createSessionStorageDriver({ getStorage: () => storage }),
    now,
  }),
});

const checkout: CheckoutRecord = {
  reservationUid: "reservation-verified",
  amount: 120_000,
};

describe("createVersionedSessionStorage", () => {
  it("writes an exact versioned, owned, expiring envelope under a static key", () => {
    const { storage, repository } = createRepository();

    expect(repository.write({ owner: ownerA, data: checkout })).toEqual({
      status: "written",
    });
    expect(repository.storageKey).toBe("airbob:checkout-v1:handoff");
    expect(repository.storageKey).not.toContain(checkout.reservationUid);
    expect(repository.storageKey).not.toContain(ownerA);
    expect(JSON.parse(storage.getItem(repository.storageKey) ?? "{}")).toEqual({
      purpose: "reservation-checkout",
      version: 1,
      privacyClass: "personal",
      containsPii: false,
      owner: ownerA,
      createdAt: 1_000,
      expiresAt: 6_000,
      data: checkout,
    });
    expect(repository.read(ownerA)).toEqual({
      status: "found",
      record: expect.objectContaining({ data: checkout, owner: ownerA }),
    });
  });

  it("refuses runtime identifiers as storage slots", () => {
    expect(() =>
      createVersionedSessionStorage<CheckoutRecord>({
        namespace: "airbob:checkout-v1",
        slot: "guest@example.com",
        purpose: "reservation-checkout",
        version: 1,
        privacyClass: "personal",
        containsPii: true,
        ttlMs: 100,
        dataKeys: ["reservationUid", "amount"],
        validateData: isCheckoutRecord,
      }),
    ).toThrow("static slugs");
  });

  it.each([
    { name: "malformed JSON", raw: "{", reason: "malformed" },
    {
      name: "unknown envelope field",
      mutate: (record: Record<string, unknown>) => ({ ...record, extra: true }),
      reason: "unknown-fields",
    },
    {
      name: "wrong version",
      mutate: (record: Record<string, unknown>) => ({ ...record, version: 2 }),
      reason: "wrong-version",
    },
    {
      name: "foreign owner",
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        owner: ownerB,
      }),
      reason: "foreign-owner",
    },
    {
      name: "unknown payload field",
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        data: { ...checkout, email: "must-not-survive@example.invalid" },
      }),
      reason: "unknown-fields",
    },
    {
      name: "wrong payload type",
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        data: { ...checkout, amount: "120000" },
      }),
      reason: "invalid-data",
    },
    {
      name: "extended lifetime",
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        expiresAt: 60_000,
      }),
      reason: "invalid-lifetime",
    },
    {
      name: "future creation time",
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        createdAt: 6_000,
        expiresAt: 11_000,
      }),
      reason: "invalid-lifetime",
    },
    {
      name: "expired record",
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        createdAt: 0,
        expiresAt: 5_000,
      }),
      reason: "expired",
    },
  ])("rejects and purges $name", ({ raw, mutate, reason }) => {
    const { storage, repository } = createRepository({ now: () => 5_000 });
    repository.write({ owner: ownerA, data: checkout });
    const valid = JSON.parse(storage.getItem(repository.storageKey) ?? "{}");
    storage.setItem(
      repository.storageKey,
      raw ?? JSON.stringify(mutate?.(valid) ?? valid),
    );

    expect(repository.read(ownerA)).toEqual({
      status: "rejected",
      reason,
      cleanup: "purged",
    });
    expect(storage.getItem(repository.storageKey)).toBeNull();
  });

  it("returns a typed failure without exposing storage values", () => {
    const storage = createStorage();
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("secret storage body");
    });
    const { repository } = createRepository({ storage });

    const result = repository.write({ owner: ownerA, data: checkout });

    expect(result).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "set" },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain(checkout.reservationUid);
  });

  it("clears only keys in its exact namespace", () => {
    const { storage, repository } = createRepository();
    storage.setItem(repository.storageKey, "record");
    storage.setItem("airbob:checkout-v1:index", "owned");
    storage.setItem("airbob:checkout-v10:handoff", "keep");
    storage.setItem("third-party", "keep");

    expect(repository.clearNamespace()).toEqual({
      status: "cleared",
      removed: 2,
    });
    expect(storage.getItem(repository.storageKey)).toBeNull();
    expect(storage.getItem("airbob:checkout-v1:index")).toBeNull();
    expect(storage.getItem("airbob:checkout-v10:handoff")).toBe("keep");
    expect(storage.getItem("third-party")).toBe("keep");
  });

  it("honors the caller currentness fence before writing", () => {
    const { storage, repository } = createRepository();

    expect(
      repository.write({
        owner: ownerA,
        data: checkout,
        isCurrent: () => false,
      }),
    ).toEqual({ status: "stale" });
    expect(storage.getItem(repository.storageKey)).toBeNull();
  });

  it("fails closed for invalid privacy metadata and clocks", () => {
    expect(() =>
      createVersionedSessionStorage<CheckoutRecord>({
        namespace: "airbob:checkout-v1",
        slot: "handoff",
        purpose: "reservation-checkout",
        version: 1,
        privacyClass: "private" as "personal",
        containsPii: false,
        ttlMs: 5_000,
        dataKeys: ["reservationUid", "amount"],
        validateData: isCheckoutRecord,
      }),
    ).toThrow("privacy class");

    const { repository } = createRepository({
      now: () => Number.MAX_SAFE_INTEGER,
    });
    expect(repository.write({ owner: ownerA, data: checkout })).toEqual({
      status: "invalid-clock",
    });
  });
});
