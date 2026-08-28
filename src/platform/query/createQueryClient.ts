import { QueryClient, QueryClientConfig } from "@tanstack/react-query";

const APP_QUERY_DEFAULTS: NonNullable<QueryClientConfig["defaultOptions"]> = {
  queries: {
    retry: 1,
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: false,
  },
};

export const createQueryClient = (
  config: QueryClientConfig = {},
): QueryClient =>
  new QueryClient({
    ...config,
    defaultOptions: {
      ...config.defaultOptions,
      queries: {
        ...APP_QUERY_DEFAULTS.queries,
        ...config.defaultOptions?.queries,
      },
      mutations: {
        ...APP_QUERY_DEFAULTS.mutations,
        ...config.defaultOptions?.mutations,
      },
    },
  });
