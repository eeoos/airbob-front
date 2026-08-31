import { createSessionStorageDriver } from "./sessionStorageDriverCore";

export type {
  SessionStorageDriver,
  StorageAccessError,
} from "./sessionStorageDriverCore";

const getBrowserSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;

  return window.sessionStorage;
};

export const sessionStorageDriver = createSessionStorageDriver({
  getStorage: getBrowserSessionStorage,
});
