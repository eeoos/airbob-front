import { createSessionStorageDriver } from "./sessionStorageDriverCore";

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

describe("sessionStorageDriver", () => {
  it("provides typed successful storage operations", () => {
    const storage = createStorage({ first: "1" });
    const driver = createSessionStorageDriver({ getStorage: () => storage });

    expect(driver.getItem("first")).toEqual({ ok: true, value: "1" });
    expect(driver.setItem("second", "2")).toEqual({
      ok: true,
      value: undefined,
    });
    expect(driver.keys()).toEqual({ ok: true, value: ["first", "second"] });
    expect(driver.removeItem("first")).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it.each(["get", "set", "remove", "keys"] as const)(
    "turns denied %s access into a safe typed failure",
    (operation) => {
      const storage = createStorage({ first: "1" });
      const method =
        operation === "get"
          ? "getItem"
          : operation === "set"
            ? "setItem"
            : operation === "remove"
              ? "removeItem"
              : "key";
      vi.spyOn(storage, method).mockImplementation(() => {
        throw new Error("private storage detail");
      });
      const driver = createSessionStorageDriver({ getStorage: () => storage });

      const result =
        operation === "get"
          ? driver.getItem("sensitive-key")
          : operation === "set"
            ? driver.setItem("sensitive-key", "sensitive-value")
            : operation === "remove"
              ? driver.removeItem("sensitive-key")
              : driver.keys();

      expect(result).toEqual({
        ok: false,
        error: { kind: "storage-unavailable", operation },
      });
      expect(JSON.stringify(result)).not.toContain("sensitive");
      expect(JSON.stringify(result)).not.toContain("private storage detail");
    },
  );

  it("handles access to the sessionStorage property itself being denied", () => {
    const driver = createSessionStorageDriver({
      getStorage: () => {
        throw new Error("denied");
      },
    });

    expect(driver.getItem("key")).toEqual({
      ok: false,
      error: { kind: "storage-unavailable", operation: "get" },
    });
  });
});
