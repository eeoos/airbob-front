import { useQuery } from "@tanstack/react-query";
import { reservationApi } from "../../../api";
import { HostDetailInfo } from "../../../types/reservation";
import { reservationQueryKeys } from "../queryKeys";

export function useHostReservationDetailQuery(reservationUid?: string) {
  return useQuery<
    HostDetailInfo,
    unknown,
    HostDetailInfo,
    ReturnType<typeof reservationQueryKeys.hostReservationDetail>
  >({
    queryKey: reservationQueryKeys.hostReservationDetail(reservationUid ?? ""),
    queryFn: () => {
      if (!reservationUid) {
        throw new Error("reservationUid is required");
      }

      return reservationApi.getHostReservationDetail(reservationUid);
    },
    enabled: Boolean(reservationUid),
    retry: false,
    throwOnError: false,
  });
}
