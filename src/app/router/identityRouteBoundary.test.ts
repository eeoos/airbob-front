import {
  clearIdentityOwnedTransactionRoute,
  isIdentityOwnedTransactionPath,
} from "./identityRouteBoundary";

describe("identityRouteBoundary", () => {
  const originalPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  afterEach(() => {
    window.history.replaceState(null, "", originalPath);
  });

  it.each([
    "/accommodations/7/confirm",
    "/accommodations/room-7/confirm/",
    "/ACCOMMODATIONS/room-7/CONFIRM//",
    "/accommodations/room%2Fa%20b%231/confirm",
    "/reservations/res-7/success",
    "/reservations/res-7/fail/",
    "/RESERVATIONS/res-7/SUCCESS//",
    "/reservations/res-7/%73uccess",
  ])("classifies %s as identity-owned", (pathname) => {
    expect(isIdentityOwnedTransactionPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/login",
    "/profile",
    "/reservations/res-7",
    "/reservations/res-7/review",
  ])("keeps non-transaction path %s", (pathname) => {
    expect(isIdentityOwnedTransactionPath(pathname)).toBe(false);
  });

  it("replaces a sensitive route and discards React Router user state", () => {
    window.history.replaceState(
      { idx: 3, key: "checkout", usr: { paymentKey: "private-key" } },
      "",
      "/reservations/res-7/success?paymentKey=private-key&amount=1000",
    );

    expect(clearIdentityOwnedTransactionRoute()).toBe(true);
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
    expect(window.history.state).toEqual({
      idx: 3,
      key: "checkout",
      usr: null,
    });
  });

  it("replaces the case-insensitive callback form accepted by the router", () => {
    window.history.replaceState(
      { idx: 4, key: "callback", usr: null },
      "",
      "/RESERVATIONS/res-7/SUCCESS//?paymentKey=private-key",
    );

    expect(clearIdentityOwnedTransactionRoute()).toBe(true);
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
  });

  it("does not rewrite a non-sensitive route", () => {
    window.history.replaceState(
      { idx: 2, key: "profile", usr: { tab: "trips" } },
      "",
      "/profile?mode=guest",
    );

    expect(clearIdentityOwnedTransactionRoute()).toBe(false);
    expect(window.location.pathname).toBe("/profile");
    expect(window.location.search).toBe("?mode=guest");
    expect(window.history.state.usr).toEqual({ tab: "trips" });
  });
});
