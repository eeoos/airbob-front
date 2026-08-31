import type { QueryClientConfig } from "@tanstack/react-query";
import { createQueryClient } from "../platform/query/createQueryClient";

const TEST_QUERY_DEFAULTS: NonNullable<QueryClientConfig["defaultOptions"]> = {
  queries: {
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
  mutations: {
    retry: false,
  },
};

export const createTestQueryClient = (config: QueryClientConfig = {}) =>
  createQueryClient({
    ...config,
    defaultOptions: {
      ...config.defaultOptions,
      queries: {
        ...TEST_QUERY_DEFAULTS.queries,
        ...config.defaultOptions?.queries,
      },
      mutations: {
        ...TEST_QUERY_DEFAULTS.mutations,
        ...config.defaultOptions?.mutations,
      },
    },
  });
