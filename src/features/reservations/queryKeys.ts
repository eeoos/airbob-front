export const reservationQueryKeys = {
  all: ["reservations"] as const,
  guestReservations: (paramsSignature: string) =>
    [...reservationQueryKeys.all, "guest", paramsSignature] as const,
  guestReservationDetail: (reservationUid: string) =>
    [...reservationQueryKeys.all, "guestDetail", reservationUid] as const,
  hostReservations: (paramsSignature: string) =>
    [...reservationQueryKeys.all, "host", paramsSignature] as const,
  hostReservationDetail: (reservationUid: string) =>
    [...reservationQueryKeys.all, "hostDetail", reservationUid] as const,
};
