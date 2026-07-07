import { useQuery } from "@tanstack/react-query";
import { reservationApi } from "../../../api";
import { ReservationDetailInfo } from "../../../types/reservation";
import { reservationQueryKeys } from "../queryKeys";

export function useReservationDetailQuery(reservationUid?: string) {
  return useQuery<
    ReservationDetailInfo,
    unknown,
    ReservationDetailInfo,
    ReturnType<typeof reservationQueryKeys.guestReservationDetail>
  >({
    queryKey: reservationQueryKeys.guestReservationDetail(reservationUid ?? ""),
    queryFn: () => {
      if (!reservationUid) {
        throw new Error("reservationUid is required");
      }

      return reservationApi.getMyReservationDetail(reservationUid);
    },
    enabled: Boolean(reservationUid),
    retry: false,
    throwOnError: false,
  });
}
