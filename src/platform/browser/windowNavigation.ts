export interface BrowserWindowNavigation {
  getOrigin(): string;
  isCurrentHistoryEntry(entry: BrowserHistoryEntry): boolean;
  openInNewTab(url: string): Window | null;
  replaceCurrentUrl(url: string): void;
}

export interface BrowserHistoryEntry {
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

  replaceCurrentUrl(url) {
    const currentState: unknown = window.history.state;
    const nextState =
      typeof currentState === "object" && currentState !== null
        ? { ...currentState, usr: null }
        : currentState;
    window.history.replaceState(nextState, "", url);
  },
};
