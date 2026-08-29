import { browserWindowNavigation } from "./windowNavigation";

describe("browserWindowNavigation", () => {
  it("matches an exact Router history entry and rejects stale route entries", () => {
    const previousUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const previousState = window.history.state;
    window.history.replaceState(
      { key: "login-entry" },
      "",
      "/login?from=profile#form",
    );

    try {
      expect(
        browserWindowNavigation.isCurrentHistoryEntry({
          key: "login-entry",
          pathname: "/login",
          search: "?from=profile",
          hash: "#form",
        }),
      ).toBe(true);
      expect(
        browserWindowNavigation.isCurrentHistoryEntry({
          key: "stale-entry",
          pathname: "/login",
          search: "?from=profile",
          hash: "#form",
        }),
      ).toBe(false);
      expect(
        browserWindowNavigation.isCurrentHistoryEntry({
          key: "login-entry",
          pathname: "/signup",
          search: "",
          hash: "",
        }),
      ).toBe(false);
    } finally {
      window.history.replaceState(previousState, "", previousUrl);
    }
  });

  it("accepts React Router's default key for a fresh BrowserRouter entry", () => {
    const previousUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const previousState = window.history.state;
    window.history.replaceState({ idx: 0 }, "", "/signup");

    try {
      expect(
        browserWindowNavigation.isCurrentHistoryEntry({
          key: "default",
          pathname: "/signup",
          search: "",
          hash: "",
        }),
      ).toBe(true);
      expect(
        browserWindowNavigation.isCurrentHistoryEntry({
          key: "stale-entry",
          pathname: "/signup",
          search: "",
          hash: "",
        }),
      ).toBe(false);
    } finally {
      window.history.replaceState(previousState, "", previousUrl);
    }
  });

  it("opens a new isolated tab without exposing the opener", () => {
    const openedWindow = { opener: {} } as Window;
    const open = jest.spyOn(window, "open").mockReturnValue(openedWindow);

    expect(browserWindowNavigation.openInNewTab("/accommodations/7")).toBe(
      openedWindow,
    );
    expect(open).toHaveBeenCalledWith(
      "/accommodations/7",
      "_blank",
      "noopener,noreferrer",
    );
    expect(openedWindow.opener).toBeNull();

    open.mockRestore();
  });
});
