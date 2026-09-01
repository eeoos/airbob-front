import { act, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { browserWindowNavigation } from "./windowNavigation";

const HistoryStateProbe = () => {
  const location = useLocation();
  return createElement(
    "output",
    { "data-testid": "history-state" },
    JSON.stringify({ key: location.key, state: location.state }),
  );
};

describe("browserWindowNavigation", () => {
  it("exposes the current browser origin without leaking window access", () => {
    expect(browserWindowNavigation.getOrigin()).toBe(window.location.origin);
  });

  it("replace-scrubs the current URL and clears React Router user state", () => {
    window.history.replaceState(
      { idx: 2, key: "history-key", usr: { secret: true } },
      "",
      "/reservations/r-1/success?paymentKey=secret",
    );

    browserWindowNavigation.replaceCurrentUrl("/reservations/r-1/success");

    expect(window.location.pathname).toBe("/reservations/r-1/success");
    expect(window.location.search).toBe("");
    expect(window.history.state).toEqual({
      idx: 2,
      key: "history-key",
      usr: null,
    });
  });

  it("replaces and reads back Router user state without changing the route lease key", () => {
    const previousUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const previousState = window.history.state;
    window.history.replaceState(
      { idx: 4, key: "booking-entry", usr: null },
      "",
      "/accommodations/42?checkIn=2026-09-10",
    );
    const reference = {
      purpose: "booking-payment-flow-reference",
      version: 2,
      flowId: "10000000-0000-4000-8000-000000000001",
      locator: { kind: "accommodation", accommodationId: 42 },
    };
    const popState = vi.fn();
    window.addEventListener("popstate", popState);

    try {
      expect(browserWindowNavigation.replaceCurrentUserState(reference)).toBe(
        true,
      );
      expect(window.history.state).toEqual({
        idx: 4,
        key: "booking-entry",
        usr: reference,
      });
      expect(browserWindowNavigation.getCurrentUserState()).toEqual(reference);
      expect(popState).toHaveBeenCalledOnce();
      expect(window.location.pathname).toBe("/accommodations/42");
      expect(window.location.search).toBe("?checkIn=2026-09-10");
    } finally {
      window.removeEventListener("popstate", popState);
      window.history.replaceState(previousState, "", previousUrl);
    }
  });

  it("synchronizes a same-key user-state replacement back into BrowserRouter", () => {
    const previousUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const previousState = window.history.state;
    window.history.replaceState(
      { idx: 0, key: "same-key-entry", usr: null },
      "",
      "/accommodations/42",
    );
    const view = render(
      createElement(BrowserRouter, null, createElement(HistoryStateProbe)),
    );
    const reference = {
      purpose: "booking-payment-flow-reference",
      version: 2,
      flowId: "10000000-0000-4000-8000-000000000001",
      locator: { kind: "accommodation", accommodationId: 42 },
    };

    try {
      act(() => {
        expect(browserWindowNavigation.replaceCurrentUserState(reference)).toBe(
          true,
        );
      });
      expect(screen.getByTestId("history-state")).toHaveTextContent(
        "same-key-entry",
      );
      expect(screen.getByTestId("history-state")).toHaveTextContent(
        reference.flowId,
      );
    } finally {
      view.unmount();
      window.history.replaceState(previousState, "", previousUrl);
    }
  });

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
    const open = vi.spyOn(window, "open").mockReturnValue(openedWindow);

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
