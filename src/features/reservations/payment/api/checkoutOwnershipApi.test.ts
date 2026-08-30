import type { CheckoutOwnershipWire } from "./contracts";
import {
  createCheckoutOwnershipApi,
  type CheckoutOwnershipApiTransport,
} from "./checkoutOwnershipApi";

const ownershipWire: CheckoutOwnershipWire = {
  reservation_uid: "reservation-123",
  check_in_date_time: "2026-07-10T15:00:00",
  check_out_date_time: "2026-07-12T11:00:00",
  guest_count: 3,
  accommodation: {
    id: 7,
    name: "경계 밖 필드",
    thumbnail_url: "/room.jpg",
  },
  payment: {
    order_id: "reservation-123",
    payment_key: "payment-key-1",
    total_amount: 120000,
    status: "IN_PROGRESS",
    method: "CARD",
  },
};

describe("checkout ownership API adapter", () => {
  it("preserves the guest-detail endpoint and maps only checkout ownership fields", async () => {
    const request = jest.fn().mockResolvedValue(ownershipWire);
    const api = createCheckoutOwnershipApi(
      request as CheckoutOwnershipApiTransport,
    );
    const signal = new AbortController().signal;

    await expect(
      api.getCheckoutOwnership("reservation-123", { signal }),
    ).resolves.toEqual({
      reservationUid: "reservation-123",
      accommodationId: 7,
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      guestCount: 3,
      payment: {
        orderId: "reservation-123",
        paymentKey: "payment-key-1",
        totalAmount: 120000,
        status: "IN_PROGRESS",
      },
    });
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/profile/guest/reservations/reservation-123",
      signal,
    });
    expect(request.mock.calls[0][0]).not.toHaveProperty("body");
    expect(request.mock.calls[0][0]).not.toHaveProperty("params");
  });

  it("accepts the guest-detail contract before a payment exists", async () => {
    const request = jest.fn().mockResolvedValue({
      ...ownershipWire,
      payment: null,
    });
    const api = createCheckoutOwnershipApi(
      request as CheckoutOwnershipApiTransport,
    );

    await expect(
      api.getCheckoutOwnership("reservation-123"),
    ).resolves.toEqual(
      expect.objectContaining({
        reservationUid: "reservation-123",
        payment: null,
      }),
    );
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ signal: undefined }),
    );
  });
});
