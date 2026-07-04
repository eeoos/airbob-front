import { QueryClient } from "@tanstack/react-query";
import { authQueryKeys } from "../features/auth/queryKeys";
import { profileQueryKeys } from "../features/profile/queryKeys";
import { reservationQueryKeys } from "../features/reservations/queryKeys";
import { searchQueryKeys } from "../features/search/queryKeys";
import { wishlistQueryKeys } from "../features/wishlist/queryKeys";
import { MeInfo } from "../types/auth";

const userScopedQueryRoots = [
  wishlistQueryKeys.all,
  profileQueryKeys.all,
  reservationQueryKeys.all,
  searchQueryKeys.all,
] as const;

export const clearSessionQueryData = async (queryClient: QueryClient) => {
  await Promise.all(
    userScopedQueryRoots.map((queryKey) =>
      queryClient.cancelQueries({ queryKey })
    )
  );

  userScopedQueryRoots.forEach((queryKey) => {
    queryClient.removeQueries({ queryKey });
  });

  await queryClient.cancelQueries({ queryKey: authQueryKeys.me() });
  queryClient.removeQueries({
    queryKey: authQueryKeys.me(),
    type: "inactive",
  });
  queryClient.setQueryData<MeInfo | null>(authQueryKeys.me(), null);
};

export const refreshSessionQueryData = async (
  queryClient: QueryClient,
  meInfo: MeInfo
) => {
  userScopedQueryRoots.forEach((queryKey) => {
    queryClient.removeQueries({ queryKey });
  });
  queryClient.setQueryData<MeInfo | null>(authQueryKeys.me(), meInfo);
};
