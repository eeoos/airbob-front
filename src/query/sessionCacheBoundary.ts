import { QueryClient } from "@tanstack/react-query";
import { MeInfo } from "../types/auth";

export const legacyAuthMeQueryKey = ["auth", "me"] as const;

const isExactAuthMeQuery = (query: { queryKey: readonly unknown[] }) =>
  query.queryKey.length === legacyAuthMeQueryKey.length &&
  query.queryKey.every(
    (part, index) => part === legacyAuthMeQueryKey[index],
  );

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
    queryKey: legacyAuthMeQueryKey,
  });
  queryClient.removeQueries({
    exact: true,
    queryKey: legacyAuthMeQueryKey,
    type: "inactive",
  });
  queryClient.setQueryData<MeInfo | null>(legacyAuthMeQueryKey, null);
};

export const refreshSessionQueryData = async (
  queryClient: QueryClient,
  meInfo: MeInfo,
) => {
  await removeNonAuthMeQueries(queryClient);
  queryClient.setQueryData<MeInfo | null>(legacyAuthMeQueryKey, meInfo);
};
