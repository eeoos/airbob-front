export const reservationQueryKeys = {
  all: ["reservations"] as const,
  guestReservations: (paramsSignature: string) =>
    [...reservationQueryKeys.all, "guest", paramsSignature] as const,
  hostReservations: (paramsSignature: string) =>
    [...reservationQueryKeys.all, "host", paramsSignature] as const,
};
