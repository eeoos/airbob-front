export interface BrowserWindowNavigation {
  isCurrentHistoryEntry(entry: BrowserHistoryEntry): boolean;
  openInNewTab(url: string): Window | null;
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
};
