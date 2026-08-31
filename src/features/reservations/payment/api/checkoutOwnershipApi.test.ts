import { requestApiData } from "../../../../platform/http/request";
import type { CheckoutOwnershipWire } from "./contracts";
import { checkoutOwnershipApi } from "./checkoutOwnershipApi";

vi.mock("../../../../platform/http/request", () => ({
  requestApiData: vi.fn(),
}));

const mockRequestApiData = vi.mocked(requestApiData);

const RESERVATION_UID = "reservation-123";

const ownershipWire: CheckoutOwnershipWire = {
  reservation_uid: RESERVATION_UID,
  check_in_date_time: "2026-07-10T15:00:00",
  check_out_date_time: "2026-07-12T11:00:00",
  guest_count: 3,
  accommodation: {
    id: 7,
    name: "경계 밖 필드",
    thumbnail_url: "/room.jpg",
  },
  payment: {
    order_id: RESERVATION_UID,
    payment_key: "payment-key-1",
    total_amount: 120000,
    status: "IN_PROGRESS",
    method: "CARD",
  },
};

describe("checkout ownership API adapter", () => {
  beforeEach(() => {
    mockRequestApiData.mockReset();
  });

  it("preserves the guest-detail endpoint and maps only checkout ownership fields", async () => {
    mockRequestApiData.mockResolvedValue(ownershipWire);
    const signal = new AbortController().signal;

    await expect(
      checkoutOwnershipApi.getCheckoutOwnership(RESERVATION_UID, { signal }),
    ).resolves.toEqual({
      reservationUid: RESERVATION_UID,
      accommodationId: 7,
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      guestCount: 3,
      payment: {
        orderId: RESERVATION_UID,
        paymentKey: "payment-key-1",
        totalAmount: 120000,
        status: "IN_PROGRESS",
      },
    });
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "GET",
      path: `/profile/guest/reservations/${RESERVATION_UID}`,
      signal,
    });
    expect(mockRequestApiData.mock.calls.at(0)?.at(0)).not.toHaveProperty(
      "body",
    );
    expect(mockRequestApiData.mock.calls.at(0)?.at(0)).not.toHaveProperty(
      "params",
    );
  });

  it("accepts the guest-detail contract before a payment exists", async () => {
    mockRequestApiData.mockResolvedValue({
      ...ownershipWire,
      payment: null,
    });
    await expect(
      checkoutOwnershipApi.getCheckoutOwnership(RESERVATION_UID),
    ).resolves.toEqual(
      expect.objectContaining({
        reservationUid: RESERVATION_UID,
        payment: null,
      }),
    );
    expect(mockRequestApiData.mock.calls[0]?.[0]).toHaveProperty(
      "signal",
      undefined,
    );
  });

  it("rejects a dot-segment UID before credentialed transport", async () => {
    await expect(
      checkoutOwnershipApi.getCheckoutOwnership("../../payments"),
    ).rejects.toMatchObject({ code: "INVALID_OPAQUE_PATH_SEGMENT" });
    expect(mockRequestApiData).not.toHaveBeenCalled();
  });
});
