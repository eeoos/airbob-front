import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../app/session/useSession";
import { toSessionSubject } from "../app/session/sessionState";
import { useAuth } from "../contexts/AuthContext";
import type {
  SessionAuthPort,
  SessionViewer,
} from "../features/auth/ports/sessionPort";
import { Dialog, ToastHost } from "../shared/ui";
import { createTestQueryClient } from "./createTestQueryClient";
import { renderApp, TEST_PORTAL_ROOT_ID } from "./renderApp";

const session: SessionViewer = {
  id: 7,
  email: "guest@example.invalid",
  nickname: "Guest",
  thumbnailImageUrl: null,
};

const nextSession: SessionViewer = {
  id: 8,
  email: "next@example.invalid",
  nickname: "Next",
  thumbnailImageUrl: null,
};

const HarnessProbe = () => {
  const auth = useAuth();
  const location = useLocation();

  return (
    <output>
      {auth.isAuthenticated ? "authenticated" : "anonymous"}|
      {location.pathname}|{String((location.state as { source?: string })?.source)}
    </output>
  );
};

const SessionNavigationProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const sessionState = useSession();
  const viewerId =
    sessionState.state.status === "authenticated"
      ? sessionState.state.viewer.id
      : "none";

  return (
    <>
      <output data-testid="session-location">
        {sessionState.state.status}:{viewerId}|{location.pathname}
      </output>
      <button type="button" onClick={() => navigate("/after-navigation")}>
        이동
      </button>
      <button
        type="button"
        onClick={() =>
          void sessionState
            .login({
              email: nextSession.email,
              password: "synthetic-password",
            })
            .catch(() => undefined)
        }
      >
        사용자 전환
      </button>
    </>
  );
};

describe("renderApp", () => {
  it("composes the real session owner, query fixtures, and memory history", () => {
    const view = renderApp(<HarnessProbe />, {
      session,
      initialEntries: [
        {
          pathname: "/reservation/confirm",
          state: { source: "router-handoff" },
        },
      ],
      seedQueryClient: (queryClient) => {
        queryClient.setQueryData(["fixture"], "seeded");
      },
    });

    expect(screen.getByText("authenticated|/reservation/confirm|router-handoff"))
      .toBeInTheDocument();
    expect(view.queryClient.getQueryData(["auth", "me"])).toBeUndefined();
    expect(view.queryClient.getDefaultOptions().queries?.meta).toEqual({
      session: { epoch: 0, subject: toSessionSubject(session) },
    });
    expect(view.queryClient.getQueryData(["fixture"])).toBe("seeded");
    expect(view.portalRoot).toBe(screen.getByTestId(TEST_PORTAL_ROOT_ID));
  });

  it("keeps the current memory-history entry across a session generation remount", async () => {
    const authPort: jest.Mocked<SessionAuthPort> = {
      getViewer: jest.fn().mockResolvedValue(nextSession),
      login: jest.fn().mockResolvedValue(undefined),
      logout: jest.fn().mockResolvedValue(undefined),
    };

    renderApp(<SessionNavigationProbe />, {
      authPort,
      initialEntries: ["/before-navigation"],
      session,
    });

    await userEvent.click(screen.getByRole("button", { name: "이동" }));
    expect(screen.getByTestId("session-location")).toHaveTextContent(
      "authenticated:7|/after-navigation",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "사용자 전환" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("session-location")).toHaveTextContent(
        "authenticated:8|/after-navigation",
      ),
    );
    expect(authPort.login).toHaveBeenCalledTimes(1);
    expect(authPort.getViewer).toHaveBeenCalledTimes(1);
  });

  it("owns query-cache and portal cleanup when the rendered tree unmounts", () => {
    const view = renderApp(<HarnessProbe />);
    view.queryClient.setQueryData(["temporary"], "value");

    view.unmount();

    expect(view.queryClient.getQueryData(["temporary"])).toBeUndefined();
    expect(screen.queryByTestId(TEST_PORTAL_ROOT_ID)).not.toBeInTheDocument();
  });

  it("releases harness-owned resources when query seeding throws", () => {
    let capturedQueryClient: ReturnType<typeof createTestQueryClient> | undefined;

    expect(() =>
      renderApp(<HarnessProbe />, {
        seedQueryClient: (queryClient) => {
          capturedQueryClient = queryClient;
          queryClient.setQueryData(["partial-seed"], "discard");
          throw new Error("fixture setup failed");
        },
      }),
    ).toThrow("fixture setup failed");

    expect(capturedQueryClient?.getQueryData(["partial-seed"])).toBeUndefined();
    expect(capturedQueryClient?.getQueryData(["auth", "me"])).toBeUndefined();
    expect(screen.queryByTestId(TEST_PORTAL_ROOT_ID)).not.toBeInTheDocument();

    const view = renderApp(<HarnessProbe />);
    view.queryClient.setQueryData(["after-failure"], "discard");
    view.unmount();

    expect(view.queryClient.getQueryData(["after-failure"])).toBeUndefined();
    expect(screen.queryByTestId(TEST_PORTAL_ROOT_ID)).not.toBeInTheDocument();
  });

  it("reference-counts a portal shared by overlapping harness renders", () => {
    const view = renderApp(<HarnessProbe />);
    const utils = renderApp(<HarnessProbe />);

    expect(view.portalRoot).toBe(utils.portalRoot);
    view.unmount();
    expect(screen.getByTestId(TEST_PORTAL_ROOT_ID)).toBe(utils.portalRoot);

    utils.unmount();
    expect(screen.queryByTestId(TEST_PORTAL_ROOT_ID)).not.toBeInTheDocument();
  });

  it("does not clear a caller-owned QueryClient while another harness uses it", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["shared"], "preserve");
    const view = renderApp(<HarnessProbe />, { queryClient });
    const utils = renderApp(<HarnessProbe />, { queryClient });

    view.unmount();

    expect(queryClient.getQueryData(["shared"])).toBe("preserve");
    expect(screen.getByText("anonymous|/|undefined")).toBeInTheDocument();

    utils.unmount();
    expect(queryClient.getQueryData(["shared"])).toBe("preserve");
  });

  it("does not remove a portal root it did not create", () => {
    const existingPortalRoot = document.createElement("div");
    existingPortalRoot.id = TEST_PORTAL_ROOT_ID;
    existingPortalRoot.dataset.testid = TEST_PORTAL_ROOT_ID;
    document.body.appendChild(existingPortalRoot);
    const view = renderApp(<HarnessProbe />);

    view.unmount();

    expect(screen.getByTestId(TEST_PORTAL_ROOT_ID)).toBe(existingPortalRoot);
  });

  it("uses the production overlay owner for Dialog and ToastHost", () => {
    const view = renderApp(
      <>
        <Dialog isOpen title="테스트 대화상자" onClose={jest.fn()}>
          content
        </Dialog>
        <ToastHost message="테스트 알림" onClose={jest.fn()} />
      </>,
    );

    expect(view.portalRoot).toContainElement(
      screen.getByRole("dialog", { name: "테스트 대화상자" }),
    );
    expect(view.portalRoot).toContainElement(screen.getByRole("alert"));

    view.unmount();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
