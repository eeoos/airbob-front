import type { ApiDataRequest } from "../../../platform/http/request";
import { encodeOpaquePathSegment } from "../../../platform/http/opaquePathSegment";
import { createReservationCreateApi } from "./reservationCreateApi";

const createTransport = () => {
  const request = jest.fn();

  return {
    request,
    transport: request as <T>(input: ApiDataRequest) => Promise<NonNullable<T>>,
  };
};

describe("reservation create API adapter", () => {
  it("preserves the exact POST body and maps the ready response", async () => {
    const { request, transport } = createTransport();
    const api = createReservationCreateApi(transport);
    const signal = new AbortController().signal;
    request.mockResolvedValue({
      reservation_uid: "reservation-123",
      order_name: "합정 테스트 숙소 2박",
      amount: 190000,
      customer_email: "guest@example.invalid",
      customer_name: "테스트 게스트",
    });

    const created = await api.create(
      {
        accommodationId: 7,
        checkIn: "2026-07-10",
        checkOut: "2026-07-12",
        guestCount: 3,
        couponId: 31,
      },
      { signal },
    );

    expect(created).toEqual({
      reservationUid: "reservation-123",
      orderName: "합정 테스트 숙소 2박",
      amount: 190000,
      customerEmail: "guest@example.invalid",
      customerName: "테스트 게스트",
    });
    expect(encodeOpaquePathSegment(created.reservationUid)).toBe(
      "reservation-123",
    );

    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/reservations",
      body: {
        accommodation_id: 7,
        check_in_date: "2026-07-10",
        check_out_date: "2026-07-12",
        guest_count: 3,
        coupon_id: 31,
      },
      signal,
    });
  });

  it("omits coupon_id rather than serializing a null coupon", async () => {
    const { request, transport } = createTransport();
    const api = createReservationCreateApi(transport);
    request.mockResolvedValue({
      reservation_uid: "reservation-124",
      order_name: "합정 테스트 숙소 1박",
      amount: 100000,
      customer_email: "guest@example.invalid",
      customer_name: "테스트 게스트",
    });

    await api.create({
      accommodationId: 7,
      checkIn: "2026-07-10",
      checkOut: "2026-07-11",
      guestCount: 1,
      couponId: null,
    });

    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/reservations",
      body: {
        accommodation_id: 7,
        check_in_date: "2026-07-10",
        check_out_date: "2026-07-11",
        guest_count: 1,
      },
      signal: undefined,
    });
  });

  it("rejects a response UID that cannot cross a downstream path boundary", async () => {
    const { request, transport } = createTransport();
    const api = createReservationCreateApi(transport);
    request.mockResolvedValue({
      reservation_uid: "../admin",
      order_name: "잘못된 예약",
      amount: 100000,
      customer_email: "guest@example.invalid",
      customer_name: "테스트 게스트",
    });

    await expect(
      api.create({
        accommodationId: 7,
        checkIn: "2026-07-10",
        checkOut: "2026-07-11",
        guestCount: 1,
        couponId: null,
      }),
    ).rejects.toThrow("reservation_uid is not a safe opaque identifier");
  });
});
