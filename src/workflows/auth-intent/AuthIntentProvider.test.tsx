import { act, render, waitFor } from "@testing-library/react";
import {
  StrictMode,
  useEffect,
  type ReactNode,
} from "react";
import {
  MemoryRouter,
  useNavigate,
  type NavigateFunction,
} from "react-router-dom";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import {
  toAuthIntentLocalDate,
  type AuthIntentAttemptId,
  type WishlistOpenAuthIntent,
} from "./authIntent";
import { AuthIntentProvider } from "./AuthIntentProvider";
import type {
  AuthIntentContextValue,
  ClaimedAuthIntent,
} from "./authIntentContext";
import { useAuthIntent } from "./useAuthIntent";

const anonymousState = {
  status: "anonymous",
  reason: "bootstrap",
} as const;

const authenticatedState = { status: "authenticated" } as const;

const checkingLoginState = {
  status: "checking",
  reason: "identity-change",
} as const;

const failedLoginState = {
  status: "error",
  reason: "identity-change",
} as const;

const failedLoginAnonymousState = {
  status: "anonymous",
  reason: "server-revoked",
} as const;

const scopeA: AuthenticatedSessionScope = {
  subject: "subject:test_a" as SessionSubject,
  epoch: 3,
};

const scopeB: AuthenticatedSessionScope = {
  subject: "subject:test_b" as SessionSubject,
  epoch: 4,
};

const wishlistIntent = (accommodationId: number): WishlistOpenAuthIntent => ({
  type: "wishlist.open",
  accommodationId,
});

type SessionSnapshot = Parameters<typeof AuthIntentProvider>[0]["session"]["state"];

interface RuntimeHarnessProps {
  readonly children: ReactNode;
  readonly sessionState?: SessionSnapshot;
  readonly sessionScope?: AuthenticatedSessionScope | null;
}

function RuntimeHarness({
  children,
  sessionState = anonymousState,
  sessionScope = null,
}: RuntimeHarnessProps) {
  const session = {
    state: sessionState,
    captureAuthenticatedSession: () => sessionScope,
    isCurrentSession: (candidate: AuthenticatedSessionScope) =>
      sessionScope?.subject === candidate.subject &&
      sessionScope.epoch === candidate.epoch,
  };

  return (
    <AuthIntentProvider session={session}>{children}</AuthIntentProvider>
  );
}

let runtime: AuthIntentContextValue;
let navigate: NavigateFunction;

function RuntimeProbe() {
  runtime = useAuthIntent();
  navigate = useNavigate();
  return null;
}

interface RenderRuntimeOptions {
  readonly sessionState?: SessionSnapshot;
  readonly sessionScope?: AuthenticatedSessionScope | null;
  readonly initialEntry?: string;
  readonly strict?: boolean;
  readonly child?: ReactNode;
}

const renderRuntime = ({
  sessionState = anonymousState,
  sessionScope = null,
  initialEntry = "/accommodations/7?checkIn=2026-07-10#booking",
  strict = false,
  child = <RuntimeProbe />,
}: RenderRuntimeOptions = {}) => {
  const tree = (
    <MemoryRouter initialEntries={[initialEntry]}>
      <RuntimeHarness
        sessionState={sessionState}
        sessionScope={sessionScope}
      >
        {child}
      </RuntimeHarness>
    </MemoryRouter>
  );

  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

describe("AuthIntentProvider", () => {
  it("keeps exactly the latest request with a monotonic opaque attempt id", () => {
    renderRuntime();

    let firstAttempt!: AuthIntentAttemptId;
    let secondAttempt!: AuthIntentAttemptId;
    act(() => {
      firstAttempt = runtime.request(wishlistIntent(7));
      secondAttempt = runtime.request({
        type: "coupon.issue",
        accommodationId: 8,
        couponId: 11,
      });
    });

    expect(secondAttempt).toBeGreaterThan(firstAttempt);
    expect(runtime.pending).toEqual({
      attemptId: secondAttempt,
      intent: {
        type: "coupon.issue",
        accommodationId: 8,
        couponId: 11,
      },
      source: {
        locationKey: "default",
        path: "/accommodations/7?checkIn=2026-07-10#booking",
      },
    });

    act(() => {
      expect(runtime.cancel(firstAttempt)).toBe(false);
    });
    expect(runtime.pending?.attemptId).toBe(secondAttempt);
  });

  it("retains an anonymous intent through login checking and failure", () => {
    const view = renderRuntime();

    let attemptId!: AuthIntentAttemptId;
    act(() => {
      attemptId = runtime.request(wishlistIntent(7));
    });

    view.rerender(
      <MemoryRouter initialEntries={["/accommodations/7"]}>
        <RuntimeHarness sessionState={checkingLoginState}>
          <RuntimeProbe />
        </RuntimeHarness>
      </MemoryRouter>,
    );
    expect(runtime.pending?.attemptId).toBe(attemptId);

    view.rerender(
      <MemoryRouter initialEntries={["/accommodations/7"]}>
        <RuntimeHarness sessionState={failedLoginState}>
          <RuntimeProbe />
        </RuntimeHarness>
      </MemoryRouter>,
    );
    expect(runtime.pending?.attemptId).toBe(attemptId);

    view.rerender(
      <MemoryRouter initialEntries={["/accommodations/7"]}>
        <RuntimeHarness sessionState={failedLoginAnonymousState}>
          <RuntimeProbe />
        </RuntimeHarness>
      </MemoryRouter>,
    );
    expect(runtime.pending?.attemptId).toBe(attemptId);

    view.rerender(
      <MemoryRouter initialEntries={["/accommodations/7"]}>
        <RuntimeHarness sessionState={{ ...failedLoginAnonymousState }}>
          <RuntimeProbe />
        </RuntimeHarness>
      </MemoryRouter>,
    );
    expect(runtime.pending?.attemptId).toBe(attemptId);
  });

  it("clears when either the source path or browser location key departs", async () => {
    renderRuntime({ initialEntry: "/accommodations/7" });

    act(() => {
      runtime.request(wishlistIntent(7));
      navigate("/accommodations/8");
    });
    await waitFor(() => expect(runtime.pending).toBeNull());

    act(() => {
      runtime.request(wishlistIntent(8));
      navigate("/accommodations/8", { replace: true });
    });
    await waitFor(() => expect(runtime.pending).toBeNull());
  });

  it("only lets the owning modal attempt cancel its pending intent", () => {
    renderRuntime();

    let firstAttempt!: AuthIntentAttemptId;
    let currentAttempt!: AuthIntentAttemptId;
    act(() => {
      firstAttempt = runtime.request(wishlistIntent(7));
      currentAttempt = runtime.request(wishlistIntent(8));
    });

    act(() => {
      expect(runtime.cancel(firstAttempt)).toBe(false);
      expect(runtime.cancel(currentAttempt)).toBe(true);
    });
    expect(runtime.pending).toBeNull();
  });

  it("clears on explicit logout and a server-revocation transition", () => {
    const view = renderRuntime();

    act(() => {
      runtime.request(wishlistIntent(7));
    });
    view.rerender(
      <MemoryRouter>
        <RuntimeHarness
          sessionState={{ status: "anonymous", reason: "logout" }}
        >
          <RuntimeProbe />
        </RuntimeHarness>
      </MemoryRouter>,
    );
    expect(runtime.pending).toBeNull();

    view.rerender(
      <MemoryRouter>
        <RuntimeHarness sessionState={anonymousState}>
          <RuntimeProbe />
        </RuntimeHarness>
      </MemoryRouter>,
    );
    act(() => {
      runtime.request(wishlistIntent(8));
    });
    view.rerender(
      <MemoryRouter>
        <RuntimeHarness sessionState={failedLoginAnonymousState}>
          <RuntimeProbe />
        </RuntimeHarness>
      </MemoryRouter>,
    );
    expect(runtime.pending).toBeNull();
  });

  it("clears as soon as the authenticated identity that owns it departs", () => {
    const view = renderRuntime({
      sessionState: authenticatedState,
      sessionScope: scopeA,
    });

    act(() => {
      runtime.request(wishlistIntent(7));
    });
    view.rerender(
      <MemoryRouter>
        <RuntimeHarness sessionState={checkingLoginState}>
          <RuntimeProbe />
        </RuntimeHarness>
      </MemoryRouter>,
    );
    expect(runtime.pending).toBeNull();

    view.rerender(
      <MemoryRouter>
        <RuntimeHarness
          sessionState={authenticatedState}
          sessionScope={scopeA}
        >
          <RuntimeProbe />
        </RuntimeHarness>
      </MemoryRouter>,
    );
    act(() => {
      runtime.request(wishlistIntent(8));
    });
    view.rerender(
      <MemoryRouter>
        <RuntimeHarness
          sessionState={authenticatedState}
          sessionScope={scopeB}
        >
          <RuntimeProbe />
        </RuntimeHarness>
      </MemoryRouter>,
    );
    expect(runtime.pending).toBeNull();
  });

  it("claims atomically only for the current authenticated session", () => {
    const view = renderRuntime({ initialEntry: "/accommodations/7" });

    act(() => {
      runtime.request(wishlistIntent(7));
    });

    let claimed: ClaimedAuthIntent<WishlistOpenAuthIntent> | null = null;
    act(() => {
      claimed = runtime.claim(
        (intent): intent is WishlistOpenAuthIntent =>
          intent.type === "wishlist.open" && intent.accommodationId === 7,
      );
    });
    expect(claimed).toBeNull();
    expect(runtime.pending).not.toBeNull();

    view.rerender(
      <MemoryRouter initialEntries={["/accommodations/7"]}>
        <RuntimeHarness
          sessionState={authenticatedState}
          sessionScope={scopeA}
        >
          <RuntimeProbe />
        </RuntimeHarness>
      </MemoryRouter>,
    );

    act(() => {
      claimed = runtime.claim(
        (intent): intent is WishlistOpenAuthIntent =>
          intent.type === "wishlist.open" && intent.accommodationId === 8,
      );
    });
    expect(claimed).toBeNull();
    expect(runtime.pending).not.toBeNull();

    act(() => {
      claimed = runtime.claim(
        (intent): intent is WishlistOpenAuthIntent =>
          intent.type === "wishlist.open" && intent.accommodationId === 7,
      );
    });
    expect(claimed).toEqual(
      expect.objectContaining({
        intent: wishlistIntent(7),
        session: scopeA,
      }),
    );
    expect(runtime.pending).toBeNull();

    act(() => {
      claimed = runtime.claim(
        (intent): intent is WishlistOpenAuthIntent =>
          intent.type === "wishlist.open",
      );
    });
    expect(claimed).toBeNull();
  });

  it("never consumes a newer request created while evaluating a claim", () => {
    renderRuntime({
      sessionState: authenticatedState,
      sessionScope: scopeA,
    });

    act(() => {
      runtime.request(wishlistIntent(7));
    });

    let replacementAttempt!: AuthIntentAttemptId;
    let claimed: ClaimedAuthIntent | null = null;
    act(() => {
      claimed = runtime.claim((intent) => {
        replacementAttempt = runtime.request(wishlistIntent(8));
        return intent.type === "wishlist.open";
      });
    });

    expect(claimed).toBeNull();
    expect(runtime.pending).toEqual(
      expect.objectContaining({
        attemptId: replacementAttempt,
        intent: wishlistIntent(8),
      }),
    );
  });

  it("keeps one latest attempt through the StrictMode effect replay", () => {
    const issuedAttempts: AuthIntentAttemptId[] = [];

    function StrictRequester() {
      const authIntent = useAuthIntent();
      const request = authIntent.request;

      useEffect(() => {
        issuedAttempts.push(request(wishlistIntent(7)));
      }, [request]);

      runtime = authIntent;
      return null;
    }

    renderRuntime({ strict: true, child: <StrictRequester /> });

    expect(issuedAttempts).toHaveLength(2);
    expect(issuedAttempts[1]).toBeGreaterThan(issuedAttempts[0]);
    expect(runtime.pending?.attemptId).toBe(issuedAttempts[1]);
  });

  it("drops its in-memory record when the provider unmounts", () => {
    const view = renderRuntime();

    let attemptId!: AuthIntentAttemptId;
    act(() => {
      attemptId = runtime.request(wishlistIntent(7));
    });
    const detachedRuntime = runtime;

    view.unmount();

    expect(detachedRuntime.cancel(attemptId)).toBe(false);
    expect(detachedRuntime.claim(() => true)).toBeNull();
  });

  it("preserves the complete reservation payload without callbacks", () => {
    renderRuntime();

    act(() => {
      runtime.request({
        type: "reservation.start",
        accommodationId: 7,
        checkIn: toAuthIntentLocalDate("2026-07-10"),
        checkOut: toAuthIntentLocalDate("2026-07-12"),
        adultCount: 2,
        childCount: 1,
        infantCount: 0,
        petCount: 1,
        couponId: null,
      });
    });

    expect(runtime.pending?.intent).toEqual({
      type: "reservation.start",
      accommodationId: 7,
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      petCount: 1,
      couponId: null,
    });
    expect(
      Object.values(runtime.pending?.intent ?? {}).some(
        (value) => typeof value === "function",
      ),
    ).toBe(false);
  });
});
