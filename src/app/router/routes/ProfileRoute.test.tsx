import { StrictMode, type ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
} from "react-router-dom";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import type {
  ProfileControllerProps,
  ProfileNavigationCommands,
  ProfileRouteView,
} from "../../../screens/profile/public";
import type {
  HostListingManagementDependencies,
  HostListingManagementWorkflow,
} from "../../../workflows/host-listing-management";
import { ProfileRoute } from "./ProfileRoute";

const scope: AuthenticatedSessionScope = {
  subject: "subject:profile-route" as SessionSubject,
  epoch: 11,
};
const mockCapturedProfileProps: ProfileControllerProps[] = [];
const mockUseSession = vi.fn();
const mockIsCurrentSession = vi.fn();
const mockCaptureAuthenticatedSession = vi.fn();
const mockIsCurrentHistoryEntry = vi.fn();
const mockCreateHostListingManagementWorkflow = vi.fn();
const mockRefreshHostListings = vi.fn();
const mockRefreshAccommodationDetail = vi.fn();
const mockConfirm = vi.fn();
const mockResolveImageUrl = vi.fn();
const mockHostListingWorkflow: HostListingManagementWorkflow = {
  dispose: vi.fn(),
  execute: vi.fn().mockResolvedValue({ status: "stale" }),
};

vi.mock("../../session/useSession", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("../../../screens/profile/public", () => ({
  ProfileController: (props: ProfileControllerProps) => {
    mockCapturedProfileProps.push(props);

    return (
      <output data-testid="profile-controller">
        {JSON.stringify(props.routeView)}
      </output>
    );
  },
}));

vi.mock("../../../workflows/host-listing-management", () => ({
  createHostListingManagementWorkflow: (
    dependencies: HostListingManagementDependencies,
  ) => mockCreateHostListingManagementWorkflow(dependencies),
}));

vi.mock("../../../features/profile/public", () => ({
  createHostListingQueryCacheProjection: () => ({
    refreshRequired: (...args: unknown[]) => mockRefreshHostListings(...args),
  }),
}));

vi.mock("../../../features/accommodations/detail/public", () => ({
  createAccommodationDetailQueryCacheProjection: () => ({
    detailRefreshRequired: (...args: unknown[]) =>
      mockRefreshAccommodationDetail(...args),
  }),
}));

vi.mock("../../../features/accommodations/api/hostListingActionsApi", () => ({
  hostListingActionsApi: {
    delete: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
  },
}));

vi.mock("../../../platform/browser/windowNavigation", () => ({
  browserWindowNavigation: {
    isCurrentHistoryEntry: (...args: unknown[]) =>
      mockIsCurrentHistoryEntry(...args),
  },
}));

vi.mock("../../../platform/browser/confirmation", () => ({
  browserConfirmation: {
    confirm: (...args: unknown[]) => mockConfirm(...args),
  },
}));

vi.mock("../../../platform/assets/imageUrl", () => ({
  resolveImageUrl: (...args: unknown[]) => mockResolveImageUrl(...args),
}));

type TestEntry =
  | string
  | {
      readonly hash?: string;
      readonly key?: string;
      readonly pathname: string;
      readonly search?: string;
    };

function RouterProbe({ children }: { readonly children?: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  return (
    <>
      <output data-testid="current-location">
        {`${location.pathname}${location.search}${location.hash}`}
      </output>
      <output data-testid="navigation-type">{navigationType}</output>
      <button type="button" onClick={() => navigate(-1)}>
        뒤로
      </button>
      <button type="button" onClick={() => navigate(1)}>
        앞으로
      </button>
      {children}
    </>
  );
}

const renderRoute = (
  initialEntries: readonly TestEntry[],
  initialIndex = initialEntries.length - 1,
  strictMode = false,
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const routeTree = () => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={initialEntries as TestEntry[]}
        initialIndex={initialIndex}
      >
        <RouterProbe>
          <Routes>
            <Route path="/profile" element={<ProfileRoute />} />
            <Route path="*" element={null} />
          </Routes>
        </RouterProbe>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const renderTree = () =>
    strictMode ? <StrictMode>{routeTree()}</StrictMode> : routeTree();
  const view = render(renderTree());

  return {
    ...view,
    rerenderRoute: () => view.rerender(renderTree()),
  };
};

const latestProfileProps = (): ProfileControllerProps => {
  const props = mockCapturedProfileProps.at(-1);
  if (!props)
    throw new Error("Expected ProfileController props to be captured");
  return props;
};

const latestWorkflowDependencies = (): HostListingManagementDependencies => {
  const calls = mockCreateHostListingManagementWorkflow.mock.calls;
  const dependencies = calls.at(-1)?.at(0) as
    HostListingManagementDependencies | undefined;
  if (!dependencies) {
    throw new Error(
      "Expected host-listing workflow dependencies to be captured",
    );
  }
  return dependencies;
};

const expectLocation = async (expected: string) => {
  await waitFor(() =>
    expect(screen.getByTestId("current-location")).toHaveTextContent(expected),
  );
};

beforeEach(() => {
  mockCapturedProfileProps.length = 0;
  mockIsCurrentSession.mockReset();
  mockIsCurrentSession.mockReturnValue(true);
  mockCaptureAuthenticatedSession.mockReset();
  mockCaptureAuthenticatedSession.mockReturnValue(scope);
  mockUseSession.mockReset();
  mockUseSession.mockReturnValue({
    captureAuthenticatedSession: mockCaptureAuthenticatedSession,
    isCurrentSession: mockIsCurrentSession,
  });
  mockIsCurrentHistoryEntry.mockReset();
  mockIsCurrentHistoryEntry.mockReturnValue(true);
  mockCreateHostListingManagementWorkflow.mockReset();
  mockCreateHostListingManagementWorkflow.mockReturnValue(
    mockHostListingWorkflow,
  );
  vi.mocked(mockHostListingWorkflow.dispose).mockClear();
  vi.mocked(mockHostListingWorkflow.execute).mockClear();
  mockRefreshHostListings.mockReset();
  mockRefreshHostListings.mockResolvedValue(undefined);
  mockRefreshAccommodationDetail.mockReset();
  mockRefreshAccommodationDetail.mockResolvedValue(undefined);
  mockConfirm.mockReset();
  mockConfirm.mockReturnValue(true);
  mockResolveImageUrl.mockReset();
  mockResolveImageUrl.mockImplementation((path: string | null) => path ?? "");
});

describe("ProfileRoute direct-load ownership", () => {
  const routeViewCases: ReadonlyArray<{
    readonly entry: string;
    readonly expected: ProfileRouteView;
    readonly label: string;
  }> = [
    {
      label: "missing query fallback",
      entry: "/profile",
      expected: {
        variant: "guest",
        activeTab: "upcoming",
        filterType: "UPCOMING",
      },
    },
    {
      label: "guest trips alias",
      entry: "/profile?mode=guest&tab=trips",
      expected: {
        variant: "guest",
        activeTab: "upcoming",
        filterType: "UPCOMING",
      },
    },
    {
      label: "guest upcoming",
      entry: "/profile?mode=guest&tab=upcoming",
      expected: {
        variant: "guest",
        activeTab: "upcoming",
        filterType: "UPCOMING",
      },
    },
    {
      label: "guest past",
      entry: "/profile?mode=guest&tab=past",
      expected: {
        variant: "guest",
        activeTab: "past",
        filterType: "PAST",
      },
    },
    {
      label: "guest cancelled",
      entry: "/profile?mode=guest&tab=cancelled",
      expected: {
        variant: "guest",
        activeTab: "cancelled",
        filterType: "CANCELLED",
      },
    },
    {
      label: "invalid guest tab fallback",
      entry: "/profile?mode=guest&tab=unknown",
      expected: {
        variant: "guest",
        activeTab: "upcoming",
        filterType: "UPCOMING",
      },
    },
    {
      label: "invalid mode fallback",
      entry: "/profile?mode=unknown&tab=past",
      expected: {
        variant: "guest",
        activeTab: "upcoming",
        filterType: "UPCOMING",
      },
    },
    {
      label: "missing host tab fallback",
      entry: "/profile?mode=host",
      expected: { variant: "host-listings", statusType: "PUBLISHED" },
    },
    {
      label: "host listings alias",
      entry: "/profile?mode=host&tab=listings",
      expected: { variant: "host-listings", statusType: "PUBLISHED" },
    },
    {
      label: "host published listings",
      entry: "/profile?mode=host&tab=listings-published",
      expected: { variant: "host-listings", statusType: "PUBLISHED" },
    },
    {
      label: "host draft listings",
      entry: "/profile?mode=host&tab=listings-draft",
      expected: { variant: "host-listings", statusType: "DRAFT" },
    },
    {
      label: "host unpublished listings",
      entry: "/profile?mode=host&tab=listings-unpublished",
      expected: { variant: "host-listings", statusType: "UNPUBLISHED" },
    },
    {
      label: "host reservations alias",
      entry: "/profile?mode=host&tab=reservations",
      expected: {
        variant: "host-reservations",
        filterType: "UPCOMING",
      },
    },
    {
      label: "host upcoming reservations",
      entry: "/profile?mode=host&tab=reservations-upcoming",
      expected: {
        variant: "host-reservations",
        filterType: "UPCOMING",
      },
    },
    {
      label: "host past reservations",
      entry: "/profile?mode=host&tab=reservations-past",
      expected: { variant: "host-reservations", filterType: "PAST" },
    },
    {
      label: "host cancelled reservations",
      entry: "/profile?mode=host&tab=reservations-cancelled",
      expected: {
        variant: "host-reservations",
        filterType: "CANCELLED",
      },
    },
    {
      label: "invalid host tab fallback",
      entry: "/profile?mode=host&tab=unknown",
      expected: { variant: "host-listings", statusType: "PUBLISHED" },
    },
  ];

  it.each(routeViewCases)("maps $label from the URL", ({ entry, expected }) => {
    renderRoute([entry]);

    expect(latestProfileProps().routeView).toEqual(expected);
    expect(latestProfileProps().scope).toBe(scope);
  });

  it("re-derives the view from browser back and forward URLs", async () => {
    renderRoute(
      ["/profile?mode=guest&tab=past", "/profile?mode=host&tab=listings-draft"],
      1,
    );
    expect(latestProfileProps().routeView).toEqual({
      variant: "host-listings",
      statusType: "DRAFT",
    });

    await userEvent.click(screen.getByRole("button", { name: "뒤로" }));
    await waitFor(() =>
      expect(latestProfileProps().routeView).toEqual({
        variant: "guest",
        activeTab: "past",
        filterType: "PAST",
      }),
    );
    await expectLocation("/profile?mode=guest&tab=past");

    await userEvent.click(screen.getByRole("button", { name: "앞으로" }));
    await waitFor(() =>
      expect(latestProfileProps().routeView).toEqual({
        variant: "host-listings",
        statusType: "DRAFT",
      }),
    );
    await expectLocation("/profile?mode=host&tab=listings-draft");
  });
});

describe("ProfileRoute navigation commands", () => {
  it("projects an encoded guest-reservation href without navigating", () => {
    renderRoute(["/profile?mode=guest&tab=upcoming"]);

    expect(latestProfileProps().hrefs.guestReservation("guest/rsv #7")).toBe(
      "/reservations/guest%2Frsv%20%237",
    );
    expect(screen.getByTestId("current-location")).toHaveTextContent(
      "/profile?mode=guest&tab=upcoming",
    );
  });

  const replaceCases: ReadonlyArray<{
    readonly expected: string;
    readonly initialEntry: string;
    readonly invoke: (navigation: ProfileNavigationCommands) => void;
    readonly label: string;
  }> = [
    {
      label: "host mode",
      initialEntry: "/profile?mode=guest&tab=past",
      invoke: (navigation) => navigation.changeMode("host"),
      expected: "/profile?mode=host&tab=listings",
    },
    {
      label: "guest mode",
      initialEntry: "/profile?mode=host&tab=reservations-past",
      invoke: (navigation) => navigation.changeMode("guest"),
      expected: "/profile?mode=guest&tab=upcoming",
    },
    {
      label: "guest tab",
      initialEntry: "/profile?mode=guest&tab=upcoming",
      invoke: (navigation) => navigation.changeGuestTab("cancelled"),
      expected: "/profile?mode=guest&tab=cancelled",
    },
    {
      label: "host listings section",
      initialEntry: "/profile?mode=host&tab=reservations-past",
      invoke: (navigation) => navigation.changeHostSection("listings"),
      expected: "/profile?mode=host&tab=listings-published",
    },
    {
      label: "host reservations section",
      initialEntry: "/profile?mode=host&tab=listings-draft",
      invoke: (navigation) => navigation.changeHostSection("reservations"),
      expected: "/profile?mode=host&tab=reservations-upcoming",
    },
    {
      label: "published listing status",
      initialEntry: "/profile?mode=host&tab=listings-draft",
      invoke: (navigation) => navigation.changeHostListingStatus("PUBLISHED"),
      expected: "/profile?mode=host&tab=listings-published",
    },
    {
      label: "draft listing status",
      initialEntry: "/profile?mode=host&tab=listings-published",
      invoke: (navigation) => navigation.changeHostListingStatus("DRAFT"),
      expected: "/profile?mode=host&tab=listings-draft",
    },
    {
      label: "unpublished listing status",
      initialEntry: "/profile?mode=host&tab=listings-draft",
      invoke: (navigation) => navigation.changeHostListingStatus("UNPUBLISHED"),
      expected: "/profile?mode=host&tab=listings-unpublished",
    },
    {
      label: "upcoming reservation filter",
      initialEntry: "/profile?mode=host&tab=reservations-past",
      invoke: (navigation) =>
        navigation.changeHostReservationFilter("UPCOMING"),
      expected: "/profile?mode=host&tab=reservations-upcoming",
    },
    {
      label: "past reservation filter",
      initialEntry: "/profile?mode=host&tab=reservations-upcoming",
      invoke: (navigation) => navigation.changeHostReservationFilter("PAST"),
      expected: "/profile?mode=host&tab=reservations-past",
    },
    {
      label: "cancelled reservation filter",
      initialEntry: "/profile?mode=host&tab=reservations-upcoming",
      invoke: (navigation) =>
        navigation.changeHostReservationFilter("CANCELLED"),
      expected: "/profile?mode=host&tab=reservations-cancelled",
    },
  ];

  it.each(replaceCases)(
    "replaces the URL for $label",
    async ({ expected, initialEntry, invoke }) => {
      renderRoute(["/history-sentinel", initialEntry], 1);

      act(() => invoke(latestProfileProps().navigation));

      await expectLocation(expected);
      expect(screen.getByTestId("navigation-type")).toHaveTextContent(
        "REPLACE",
      );
    },
  );

  const destinationCases: ReadonlyArray<{
    readonly expected: string;
    readonly invoke: (navigation: ProfileNavigationCommands) => void;
    readonly label: string;
  }> = [
    {
      label: "guest reservation detail",
      invoke: (navigation) =>
        navigation.openGuestReservation("guest-reservation-7"),
      expected: "/reservations/guest-reservation-7",
    },
    {
      label: "host reservation detail",
      invoke: (navigation) =>
        navigation.openHostReservation("host-reservation-8"),
      expected: "/profile/host/reservations/host-reservation-8",
    },
    {
      label: "accommodation detail",
      invoke: (navigation) => navigation.openAccommodation(41),
      expected: "/accommodations/41",
    },
    {
      label: "accommodation editor",
      invoke: (navigation) => navigation.editAccommodation(42),
      expected: "/accommodations/42/edit",
    },
  ];

  it.each(destinationCases)("opens $label", async ({ expected, invoke }) => {
    renderRoute(["/profile?mode=guest&tab=upcoming"]);

    act(() => invoke(latestProfileProps().navigation));

    await expectLocation(expected);
    expect(screen.getByTestId("navigation-type")).toHaveTextContent("PUSH");
  });
});

describe("ProfileRoute publication ownership", () => {
  it("awaits exact scoped detail and host-listing refreshes", async () => {
    const failure = new Error("detail invalidation failed");
    mockRefreshAccommodationDetail.mockRejectedValueOnce(failure);
    renderRoute(["/profile?mode=host&tab=listings"]);
    const dependencies = latestWorkflowDependencies();

    await expect(
      dependencies.publication.publishHostListingChanged({
        accommodationId: 42,
        action: "publish",
        scope,
      }),
    ).rejects.toBe(failure);
    expect(mockRefreshHostListings).toHaveBeenCalledWith({ scope });
    expect(mockRefreshAccommodationDetail).toHaveBeenCalledWith({
      accommodationId: 42,
      scope,
    });
  });
});

describe("ProfileRoute authority gates", () => {
  it("keeps the committed workflow alive through StrictMode effect replay", async () => {
    const view = renderRoute(["/profile?mode=host&tab=listings"], 0, true);

    await act(async () => Promise.resolve());
    expect(mockHostListingWorkflow.dispose).not.toHaveBeenCalled();

    view.unmount();
    await act(async () => Promise.resolve());
    expect(mockHostListingWorkflow.dispose).toHaveBeenCalledTimes(1);
  });

  it("creates and disposes separate workflows for session generations", async () => {
    const nextScope: AuthenticatedSessionScope = {
      subject: "subject:profile-route-next" as SessionSubject,
      epoch: scope.epoch + 1,
    };
    const firstWorkflow = {
      dispose: vi.fn(),
      execute: vi.fn().mockResolvedValue({ status: "stale" }),
    } satisfies HostListingManagementWorkflow;
    const nextWorkflow = {
      dispose: vi.fn(),
      execute: vi.fn().mockResolvedValue({ status: "stale" }),
    } satisfies HostListingManagementWorkflow;
    mockCreateHostListingManagementWorkflow
      .mockReturnValueOnce(firstWorkflow)
      .mockReturnValue(nextWorkflow);
    const view = renderRoute(["/profile?mode=host&tab=listings"]);

    expect(latestProfileProps().hostListingWorkflow).toBe(firstWorkflow);
    mockCaptureAuthenticatedSession.mockReturnValue(nextScope);
    view.rerenderRoute();

    expect(latestProfileProps()).toMatchObject({
      hostListingWorkflow: nextWorkflow,
      scope: nextScope,
    });
    await act(async () => Promise.resolve());
    expect(firstWorkflow.dispose).toHaveBeenCalledTimes(1);
    expect(nextWorkflow.dispose).not.toHaveBeenCalled();
  });

  it("does not render the controller without an authenticated scope", () => {
    mockCaptureAuthenticatedSession.mockReturnValue(null);

    renderRoute(["/profile"]);

    expect(screen.queryByTestId("profile-controller")).not.toBeInTheDocument();
    expect(mockIsCurrentSession).not.toHaveBeenCalled();
  });

  it("does not render the controller for a non-current scope", () => {
    mockIsCurrentSession.mockReturnValue(false);

    renderRoute(["/profile"]);

    expect(mockIsCurrentSession).toHaveBeenCalledWith(scope);
    expect(screen.queryByTestId("profile-controller")).not.toBeInTheDocument();
  });

  it("leases the exact history entry and reflects a stale result", () => {
    mockIsCurrentHistoryEntry.mockReturnValue(false);
    renderRoute([
      {
        pathname: "/profile",
        search: "?mode=host&tab=listings-draft",
        hash: "#listing-actions",
        key: "profile-entry-11",
      },
    ]);

    expect(latestWorkflowDependencies().routeLease.isCurrent()).toBe(false);
    expect(mockIsCurrentHistoryEntry).toHaveBeenCalledWith({
      hash: "#listing-actions",
      key: "profile-entry-11",
      pathname: "/profile",
      search: "?mode=host&tab=listings-draft",
    });
  });
});
