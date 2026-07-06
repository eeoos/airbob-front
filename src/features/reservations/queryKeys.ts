export const reservationQueryKeys = {
  all: ["reservations"] as const,
  guestReservationsRoot: ["reservations", "guest"] as const,
  guestReservations: (paramsSignature: string) =>
    [...reservationQueryKeys.guestReservationsRoot, paramsSignature] as const,
  guestReservationDetail: (reservationUid: string) =>
    [...reservationQueryKeys.all, "guestDetail", reservationUid] as const,
  hostReservations: (paramsSignature: string) =>
    [...reservationQueryKeys.all, "host", paramsSignature] as const,
  hostReservationDetail: (reservationUid: string) =>
    [...reservationQueryKeys.all, "hostDetail", reservationUid] as const,
  confirmAccommodation: (
    accommodationId: number | null,
    reservationUid: string | null,
  ) =>
    [
      ...reservationQueryKeys.all,
      "confirmAccommodation",
      accommodationId ?? "missing",
      reservationUid ?? "missing",
    ] as const,
};
