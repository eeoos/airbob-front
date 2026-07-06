import type { QueryClient } from "@tanstack/react-query";
import { authApi } from "../../../api";
import {
  clearSessionQueryData,
  refreshSessionQueryData,
} from "../../../query/sessionCacheBoundary";
import type { MeInfo } from "../../../types/auth";
import { clearAllReservationCheckoutState } from "../../reservations/publicCache";

export const clearAuthenticatedSession = async (queryClient: QueryClient) => {
  clearAllReservationCheckoutState();
  await clearSessionQueryData(queryClient);
};

export const refreshAuthenticatedSession = async (
  queryClient: QueryClient
): Promise<MeInfo> => {
  try {
    const meInfo = await authApi.getMe();
    await refreshSessionQueryData(queryClient, meInfo);
    return meInfo;
  } catch (error) {
    await clearAuthenticatedSession(queryClient);
    throw error;
  }
};
