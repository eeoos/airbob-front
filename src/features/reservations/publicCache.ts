import type { QueryClient } from "@tanstack/react-query";
import { clearAllReservationCheckoutState } from "./lib/reservationCheckoutState";
import { reservationQueryKeys } from "./queryKeys";

export { clearAllReservationCheckoutState };

export const invalidateGuestReservationCaches = async (
  queryClient: QueryClient,
  reservationUid: string,
) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: reservationQueryKeys.guestReservationDetail(reservationUid),
    }),
    queryClient.invalidateQueries({
      queryKey: reservationQueryKeys.guestReservationsRoot,
    }),
  ]);
};

export const invalidateReservationPaymentCaches =
  invalidateGuestReservationCaches;
