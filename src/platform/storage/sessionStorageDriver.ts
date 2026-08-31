export type StorageOperation = "get" | "set" | "remove" | "keys";

export interface StorageAccessError {
  kind: "storage-unavailable";
  operation: StorageOperation;
}

export type StorageAccessResult<T> =
  { ok: true; value: T } | { ok: false; error: StorageAccessError };

export interface SessionStorageDriver {
  getItem(key: string): StorageAccessResult<string | null>;
  setItem(key: string, value: string): StorageAccessResult<void>;
  removeItem(key: string): StorageAccessResult<void>;
  keys(): StorageAccessResult<readonly string[]>;
}

export interface CreateSessionStorageDriverOptions {
  getStorage?: () => Storage | null;
}

const storageFailure = <T>(
  operation: StorageOperation,
): StorageAccessResult<T> => ({
  ok: false,
  error: { kind: "storage-unavailable", operation },
});

const defaultStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;

  return window.sessionStorage;
};

export const createSessionStorageDriver = ({
  getStorage = defaultStorage,
}: CreateSessionStorageDriverOptions = {}): SessionStorageDriver => {
  const withStorage = <T>(
    operation: StorageOperation,
    action: (storage: Storage) => T,
  ): StorageAccessResult<T> => {
    try {
      const storage = getStorage();
      if (!storage) return storageFailure(operation);

      return { ok: true, value: action(storage) };
    } catch {
      return storageFailure(operation);
    }
  };

  return {
    getItem: (key) => withStorage("get", (storage) => storage.getItem(key)),
    setItem: (key, value) =>
      withStorage("set", (storage) => {
        storage.setItem(key, value);
      }),
    removeItem: (key) =>
      withStorage("remove", (storage) => {
        storage.removeItem(key);
      }),
    keys: () =>
      withStorage("keys", (storage) =>
        Array.from({ length: storage.length }, (_, index) =>
          storage.key(index),
        ).filter((key): key is string => key !== null),
      ),
  };
};

export const sessionStorageDriver = createSessionStorageDriver();
