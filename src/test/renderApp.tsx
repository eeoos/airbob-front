import { QueryClient } from "@tanstack/react-query";
import {
  render,
  RenderOptions,
  RenderResult,
} from "@testing-library/react";
import { ReactElement, ReactNode, useEffect } from "react";
import { MemoryRouter, MemoryRouterProps } from "react-router-dom";
import {
  APP_OVERLAY_ROOT_ID,
  OverlayProvider,
} from "../app/overlays/OverlayProvider";
import { AuthIntentStableBoundary } from "../app/providers/AppProviders";
import { SessionProvider } from "../app/session/SessionProvider";
import {
  toSessionSubject,
  type SessionState,
} from "../app/session/sessionState";
import { AuthProvider } from "../contexts/AuthContext";
import type { SessionAuthPort } from "../features/auth/ports/sessionPort";
import { MeInfo } from "../types/auth";
import { createTestQueryClient } from "./createTestQueryClient";

export const TEST_PORTAL_ROOT_ID = APP_OVERLAY_ROOT_ID;

export interface RenderAppOptions
  extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
  initialEntries?: MemoryRouterProps["initialEntries"];
  session?: MeInfo | null;
  authPort?: SessionAuthPort;
  seedQueryClient?: (queryClient: QueryClient) => void;
}

export interface RenderAppResult extends RenderResult {
  queryClient: QueryClient;
  portalRoot: HTMLElement;
}

interface PortalOwnership {
  createdByHarness: boolean;
  references: number;
}

const portalOwnership = new WeakMap<HTMLElement, PortalOwnership>();

interface QueryClientOwnership {
  clearWhenUnused: boolean;
  references: number;
}

const queryClientOwnership = new WeakMap<QueryClient, QueryClientOwnership>();

const ensurePortalRoot = () => {
  const existing = document.getElementById(TEST_PORTAL_ROOT_ID);
  if (existing) {
    if (!portalOwnership.has(existing)) {
      portalOwnership.set(existing, {
        createdByHarness: false,
        references: 0,
      });
    }
    return existing;
  }

  const portalRoot = document.createElement("div");
  portalRoot.id = TEST_PORTAL_ROOT_ID;
  portalRoot.dataset.testid = TEST_PORTAL_ROOT_ID;
  document.body.appendChild(portalRoot);
  portalOwnership.set(portalRoot, {
    createdByHarness: true,
    references: 0,
  });
  return portalRoot;
};

export const cleanupTestPortalRoot = () => {
  const portalRoot = document.getElementById(TEST_PORTAL_ROOT_ID);
  if (!portalRoot) return;

  portalOwnership.delete(portalRoot);
  portalRoot.remove();
};

const retainPortalRoot = (portalRoot: HTMLElement) => {
  const ownership = portalOwnership.get(portalRoot);
  if (!ownership) return;

  ownership.references += 1;
};

const releasePortalRoot = (portalRoot: HTMLElement) => {
  const ownership = portalOwnership.get(portalRoot);
  if (!ownership || ownership.references === 0) return;

  ownership.references -= 1;
  if (ownership.references === 0) {
    portalOwnership.delete(portalRoot);
    if (ownership.createdByHarness) portalRoot.remove();
  }
};

const retainQueryClient = (
  queryClient: QueryClient,
  createdByHarness: boolean
) => {
  const ownership = queryClientOwnership.get(queryClient) ?? {
    clearWhenUnused: createdByHarness,
    references: 0,
  };

  ownership.clearWhenUnused ||= createdByHarness;
  ownership.references += 1;
  queryClientOwnership.set(queryClient, ownership);
};

const releaseQueryClient = (queryClient: QueryClient) => {
  const ownership = queryClientOwnership.get(queryClient);
  if (!ownership || ownership.references === 0) return;

  ownership.references -= 1;
  if (ownership.references !== 0) return;

  queryClientOwnership.delete(queryClient);
  if (ownership.clearWhenUnused) queryClient.clear();
};

const toInitialSessionState = (session: MeInfo | null): SessionState =>
  session
    ? {
        status: "authenticated",
        viewer: session,
        subject: toSessionSubject(session),
        epoch: 0,
        revalidation: { status: "idle" },
      }
    : {
        status: "anonymous",
        reason: "bootstrap",
        revocation: "verified",
        operationId: 0,
        epoch: 0,
      };

export const renderApp = (
  ui: ReactElement,
  options: RenderAppOptions = {}
): RenderAppResult => {
  const {
    queryClient: providedQueryClient,
    initialEntries = ["/"],
    session = null,
    authPort,
    seedQueryClient,
    ...renderOptions
  } = options;
  const queryClient = providedQueryClient ?? createTestQueryClient();
  const portalRoot = ensurePortalRoot();
  retainPortalRoot(portalRoot);
  retainQueryClient(queryClient, providedQueryClient === undefined);
  let didReleaseResources = false;
  const releaseResources = () => {
    if (didReleaseResources) return;

    didReleaseResources = true;
    releaseQueryClient(queryClient);
    releasePortalRoot(portalRoot);
  };
  let mounted = false;
  let mountGeneration = 0;

  const AppProviders = ({ children }: { children: ReactNode }) => {
    useEffect(() => {
      mounted = true;
      mountGeneration += 1;

      return () => {
        mounted = false;
        const unmountGeneration = mountGeneration;
        void Promise.resolve().then(() => {
          if (!mounted && mountGeneration === unmountGeneration) {
            releaseResources();
          }
        });
      };
    }, []);

    return (
      <MemoryRouter initialEntries={initialEntries}>
        <OverlayProvider portalRoot={portalRoot}>
          <SessionProvider
            authPort={authPort}
            initialQueryClient={queryClient}
            initialState={toInitialSessionState(session)}
            stableBoundary={AuthIntentStableBoundary}
          >
            <AuthProvider>{children}</AuthProvider>
          </SessionProvider>
        </OverlayProvider>
      </MemoryRouter>
    );
  };

  try {
    seedQueryClient?.(queryClient);

    const rendered = render(ui, { ...renderOptions, wrapper: AppProviders });
    const unmount = rendered.unmount;

    return {
      ...rendered,
      unmount: () => {
        unmount();
        releaseResources();
      },
      queryClient,
      portalRoot,
    };
  } catch (error) {
    releaseResources();
    throw error;
  }
};
