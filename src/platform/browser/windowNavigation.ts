export interface BrowserWindowNavigation {
  getOrigin(): string;
  getCurrentUserState(): unknown;
  isCurrentHistoryEntry(entry: BrowserHistoryEntry): boolean;
  openInNewTab(url: string): Window | null;
  replaceCurrentUserState(state: unknown): boolean;
  replaceCurrentUrl(url: string): void;
}

interface BrowserHistoryEntry {
  readonly hash: string;
  readonly key: string;
  readonly pathname: string;
  readonly search: string;
}

const readCurrentHistoryKey = (): string | null => {
  const state: unknown = window.history.state;

  return typeof state === "object" &&
    state !== null &&
    "key" in state &&
    typeof state.key === "string"
    ? state.key
    : null;
};

export const browserWindowNavigation: BrowserWindowNavigation = {
  getOrigin() {
    return window.location.origin;
  },

  getCurrentUserState() {
    const state: unknown = window.history.state;
    return typeof state === "object" && state !== null && "usr" in state
      ? state.usr
      : null;
  },

  isCurrentHistoryEntry(entry) {
    const currentHistoryKey = readCurrentHistoryKey();
    const isSameHistoryKey =
      currentHistoryKey === entry.key ||
      (currentHistoryKey === null && entry.key === "default");

    return (
      isSameHistoryKey &&
      window.location.pathname === entry.pathname &&
      window.location.search === entry.search &&
      window.location.hash === entry.hash
    );
  },

  openInNewTab(url) {
    const openedWindow = window.open(url, "_blank", "noopener,noreferrer");

    if (openedWindow) {
      openedWindow.opener = null;
    }

    return openedWindow;
  },

  replaceCurrentUserState(userState) {
    try {
      const expected = JSON.stringify(userState);
      if (expected === undefined) return false;
      const currentState: unknown = window.history.state;
      const currentRecord =
        typeof currentState === "object" &&
        currentState !== null &&
        !Array.isArray(currentState)
          ? currentState
          : {};
      const currentKey = readCurrentHistoryKey();
      window.history.replaceState(
        { ...currentRecord, usr: userState },
        "",
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
      const writtenState: unknown = window.history.state;
      if (
        typeof writtenState !== "object" ||
        writtenState === null ||
        !("usr" in writtenState)
      ) {
        return false;
      }
      const verified =
        readCurrentHistoryKey() === currentKey &&
        JSON.stringify(writtenState.usr) === expected;
      if (verified) {
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: window.history.state }),
        );
      }
      return verified;
    } catch {
      return false;
    }
  },

  replaceCurrentUrl(url) {
    const currentState: unknown = window.history.state;
    const nextState =
      typeof currentState === "object" && currentState !== null
        ? { ...currentState, usr: null }
        : currentState;
    window.history.replaceState(nextState, "", url);
  },
};
