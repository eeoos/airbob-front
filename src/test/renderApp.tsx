import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  render,
  RenderOptions,
  RenderResult,
} from "@testing-library/react";
import { ReactElement, ReactNode, useEffect } from "react";
import { MemoryRouter, MemoryRouterProps } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";
import { authQueryKeys } from "../features/auth/queryKeys";
import { MeInfo } from "../types/auth";
import { createTestQueryClient } from "./createTestQueryClient";

export const TEST_PORTAL_ROOT_ID = "airbob-portal-root";

export interface RenderAppOptions
  extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
  initialEntries?: MemoryRouterProps["initialEntries"];
  session?: MeInfo | null;
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

export const renderApp = (
  ui: ReactElement,
  options: RenderAppOptions = {}
): RenderAppResult => {
  const {
    queryClient: providedQueryClient,
    initialEntries = ["/"],
    session = null,
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
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  try {
    queryClient.setQueryDefaults(authQueryKeys.me(), {
      retry: false,
      staleTime: Infinity,
    });
    queryClient.setQueryData<MeInfo | null>(authQueryKeys.me(), session);
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
