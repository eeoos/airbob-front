import { QueryClient } from "@tanstack/react-query";
import { authQueryKeys } from "../features/auth/queryKeys";
import { MeInfo } from "../types/auth";

const authMeQueryKey = authQueryKeys.me();

const isExactAuthMeQuery = (query: { queryKey: readonly unknown[] }) =>
  query.queryKey.length === authMeQueryKey.length &&
  query.queryKey.every((part, index) => part === authMeQueryKey[index]);

const nonAuthMeQueryFilter = {
  predicate: (query: { queryKey: readonly unknown[] }) =>
    !isExactAuthMeQuery(query),
};

const removeNonAuthMeQueries = async (queryClient: QueryClient) => {
  await queryClient.cancelQueries(nonAuthMeQueryFilter);
  queryClient.removeQueries(nonAuthMeQueryFilter);
};

export const clearSessionQueryData = async (queryClient: QueryClient) => {
  await removeNonAuthMeQueries(queryClient);

  await queryClient.cancelQueries({
    exact: true,
    queryKey: authMeQueryKey,
  });
  queryClient.removeQueries({
    exact: true,
    queryKey: authMeQueryKey,
    type: "inactive",
  });
  queryClient.setQueryData<MeInfo | null>(authMeQueryKey, null);
};

export const refreshSessionQueryData = async (
  queryClient: QueryClient,
  meInfo: MeInfo,
) => {
  await removeNonAuthMeQueries(queryClient);
  queryClient.setQueryData<MeInfo | null>(authMeQueryKey, meInfo);
};
