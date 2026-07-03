import { useQuery } from "@tanstack/react-query";
import { authApi } from "../../../api";
import { MeInfo } from "../../../types/auth";
import { authQueryKeys } from "../queryKeys";

export function useSessionQuery() {
  return useQuery<
    MeInfo,
    Error,
    MeInfo | null,
    ReturnType<typeof authQueryKeys.me>
  >({
    queryKey: authQueryKeys.me(),
    queryFn: authApi.getMe,
    retry: false,
  });
}
