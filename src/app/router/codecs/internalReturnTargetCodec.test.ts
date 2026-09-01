import { internalReturnTargetCodec } from "./internalReturnTargetCodec";

const locationState = (pathname: string, search = "", hash = ""): unknown => ({
  from: { pathname, search, hash },
});

describe("internalReturnTargetCodec", () => {
  it("preserves a structured internal pathname, query, and hash", () => {
    const state = locationState(
      "/accommodations/%ED%95%9C%EA%B8%80",
      "?destination=%EC%84%9C%EC%9A%B8&next=a%2Fb",
      "#%EC%9C%84%EC%B9%98",
    );

    expect(internalReturnTargetCodec.parse(state)).toEqual({
      pathname: "/accommodations/%ED%95%9C%EA%B8%80",
      search: "?destination=%EC%84%9C%EC%9A%B8&next=a%2Fb",
      hash: "#%EC%9C%84%EC%B9%98",
    });
    expect(internalReturnTargetCodec.canonicalize(state)).toBe(
      "/accommodations/%ED%95%9C%EA%B8%80?destination=%EC%84%9C%EC%9A%B8&next=a%2Fb#%EC%9C%84%EC%B9%98",
    );
  });

  it("normalizes same-origin dot segments", () => {
    expect(
      internalReturnTargetCodec.parse(locationState("/profile/../wishlist")),
    ).toEqual({ pathname: "/wishlist", search: "", hash: "" });
  });

  it.each([
    ["protocol-relative", "//evil.example/steal"],
    ["absolute scheme", "https://evil.example/steal"],
    ["javascript scheme", ["javascript", "alert(1)"].join(":")],
    ["backslash authority", "/\\evil.example/steal"],
    ["encoded slash", "/%2f%2fevil.example/steal"],
    ["encoded backslash", "/%5c%5cevil.example/steal"],
    ["double-encoded slash", "/%252f%252fevil.example/steal"],
    ["split double-encoded slash", "/%25%32%66%25%32%66evil.example"],
  ])("rejects %s targets", (_label, pathname) => {
    expect(internalReturnTargetCodec.parse(locationState(pathname))).toBeNull();
  });

  it.each([
    ["raw control", "/search\nnext"],
    ["encoded control", "/search%0anext"],
    ["double-encoded control", "/search%250anext"],
    ["split double-encoded control", "/search%25%30%61next"],
    ["malformed percent", "/search%2"],
    ["nested malformed percent", "/%25zz"],
    ["invalid UTF-8", "/search%ff"],
  ])("rejects %s characters", (_label, pathname) => {
    expect(internalReturnTargetCodec.parse(locationState(pathname))).toBeNull();
  });

  it.each([
    "/login",
    "/login/",
    "/LOGIN",
    "/%6cogin",
    "/%25%36%63ogin",
    "/signup",
    "/signup/",
    "/%73ignup",
  ])("rejects auth return loops for %s", (pathname) => {
    expect(internalReturnTargetCodec.parse(locationState(pathname))).toBeNull();
  });

  it.each([
    "/accommodations/7/confirm",
    "/reservations/res-7/success",
    "/reservations/res-7/fail",
    "/reservations/res-7/%73uccess",
    "/RESERVATIONS/res-7/SUCCESS//",
  ])("rejects identity-owned transaction return targets for %s", (pathname) => {
    expect(internalReturnTargetCodec.parse(locationState(pathname))).toBeNull();
  });

  it("admits only the exact clean success target for an already-claimed payment recovery", () => {
    const expectedPath = "/reservations/res-7/success";
    expect(
      internalReturnTargetCodec.parseClaimedPaymentRecovery(
        locationState(expectedPath),
        expectedPath,
      ),
    ).toEqual({ pathname: expectedPath, search: "", hash: "" });
    expect(
      internalReturnTargetCodec.parse(locationState(expectedPath)),
    ).toBeNull();

    expect(
      internalReturnTargetCodec.parseClaimedPaymentRecovery(
        locationState(expectedPath, "?paymentKey=secret"),
        expectedPath,
      ),
    ).toBeNull();
    expect(
      internalReturnTargetCodec.parseClaimedPaymentRecovery(
        locationState("/reservations/other/success"),
        expectedPath,
      ),
    ).toBeNull();
    expect(
      internalReturnTargetCodec.parseClaimedPaymentRecovery(
        locationState("/reservations/res-7/fail"),
        "/reservations/res-7/fail",
      ),
    ).toBeNull();
  });

  it("rejects malformed structured parts and extra fields", () => {
    expect(
      internalReturnTargetCodec.parse(
        locationState("/search", "destination=x"),
      ),
    ).toBeNull();
    expect(
      internalReturnTargetCodec.parse(locationState("/search", "?q=x#escape")),
    ).toBeNull();
    expect(
      internalReturnTargetCodec.parse(locationState("/search", "", "section")),
    ).toBeNull();
    expect(
      internalReturnTargetCodec.parse({
        from: { pathname: "/search", search: "", hash: "", origin: "evil" },
      }),
    ).toBeNull();
    expect(
      internalReturnTargetCodec.parse({
        from: { pathname: "/search", search: "", hash: "" },
        next: "https://evil.example",
      }),
    ).toBeNull();
  });

  it("rejects missing, non-string, and direct unwrapped targets", () => {
    expect(internalReturnTargetCodec.parse(null)).toBeNull();
    expect(internalReturnTargetCodec.parse({})).toBeNull();
    expect(
      internalReturnTargetCodec.parse({
        from: { pathname: "/search", search: null, hash: "" },
      }),
    ).toBeNull();
    expect(
      internalReturnTargetCodec.parse({
        pathname: "/search",
        search: "",
        hash: "",
      }),
    ).toBeNull();
  });

  it("never invokes or leaks throwing getters", () => {
    const targetWithGetter = {
      get pathname(): string {
        throw new Error("must not execute");
      },
      search: "",
      hash: "",
    };
    const stateWithGetter = {
      get from(): unknown {
        throw new Error("must not execute");
      },
    };
    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("hostile proxy");
        },
      },
    );

    expect(
      internalReturnTargetCodec.parse({ from: targetWithGetter }),
    ).toBeNull();
    expect(internalReturnTargetCodec.parse(stateWithGetter)).toBeNull();
    expect(internalReturnTargetCodec.parse(proxy)).toBeNull();
  });

  it("creates only validated location state", () => {
    expect(
      internalReturnTargetCodec.createLocationState({
        pathname: "/search",
        search: "?destination=Seoul",
        hash: "#map",
      }),
    ).toEqual({
      from: {
        pathname: "/search",
        search: "?destination=Seoul",
        hash: "#map",
      },
    });
    expect(
      internalReturnTargetCodec.createLocationState({
        pathname: "//evil.example",
        search: "",
        hash: "",
      }),
    ).toBeNull();
  });
});
