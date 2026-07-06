import type { QueryClient } from "@tanstack/react-query";
import { invalidateReservationPaymentCaches } from "./publicCache";
import { reservationQueryKeys } from "./queryKeys";

describe("reservation public cache", () => {
  it("invalidates guest detail and list caches after payment confirmation", async () => {
    const invalidateQueries = jest.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    await invalidateReservationPaymentCaches(queryClient, "reservation-1");

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reservationQueryKeys.guestReservationDetail("reservation-1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reservationQueryKeys.guestReservationsRoot,
    });
  });
});
