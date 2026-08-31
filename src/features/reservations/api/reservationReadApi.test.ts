import type {
  GuestReservationDetailWire,
  GuestReservationPageWire,
  HostReservationDetailWire,
  HostReservationPageWire,
} from "./reservationReadContracts";
import {
  createReservationReadApi,
  type ReservationReadApiTransport,
} from "./reservationReadApi";

const RESERVATION_UID = "reservation-123";

const accommodation = {
  id: 7,
  name: "테스트 숙소",
  thumbnail_url: null,
} as const;

const member = {
  id: 9,
  nickname: "회원",
  thumbnail_image_url: null,
} as const;

const pageInfo = {
  current_size: 0,
  has_next: false,
  next_cursor: null,
} as const;

const address = {
  country: "대한민국",
  state: null,
  city: "서울",
  district: null,
  street: "와우산로",
  detail: null,
  postal_code: "04000",
} as const;

const detailBase = {
  reservation_uid: RESERVATION_UID,
  reservation_code: "R-1",
  status: "CONFIRMED",
  created_at: "2026-07-01T00:00:00Z",
  guest_count: 2,
  check_in_date_time: "2026-07-10T15:00:00Z",
  check_out_date_time: "2026-07-12T11:00:00Z",
  accommodation,
  address,
  payment: null,
} as const;

describe("reservation read API adapter", () => {
  it.each([
    ["guest", "/profile/guest/reservations"],
    ["host", "/profile/host/reservations"],
  ] as const)(
    "preserves the %s list path, params, and AbortSignal",
    async (audience, path) => {
      const transport = jest.fn();
      const wire: GuestReservationPageWire | HostReservationPageWire = {
        page_info: pageInfo,
        reservations: [],
      };
      transport.mockResolvedValue(wire);
      const api = createReservationReadApi(
        transport as ReservationReadApiTransport,
      );
      const signal = new AbortController().signal;

      await expect(
        api.getList(
          audience,
          {
            cursor: "cursor-1",
            filterType: "PAST",
            size: 20,
          },
          { signal },
        ),
      ).resolves.toMatchObject({ audience });
      expect(transport).toHaveBeenCalledWith({
        method: "GET",
        path,
        params: {
          cursor: "cursor-1",
          filterType: "PAST",
          size: 20,
        },
        signal,
      });
    },
  );

  it.each([
    [
      "guest",
      `/profile/guest/reservations/${RESERVATION_UID}`,
      {
        ...detailBase,
        can_write_review: true,
        check_in_time: "15:00:00",
        check_out_time: "11:00:00",
        coordinate: { latitude: 37.5, longitude: 127 },
        host: member,
      } satisfies GuestReservationDetailWire,
    ],
    [
      "host",
      `/profile/host/reservations/${RESERVATION_UID}`,
      {
        ...detailBase,
        guest: member,
      } satisfies HostReservationDetailWire,
    ],
  ] as const)(
    "preserves the %s detail path and maps its audience",
    async (audience, path, wire) => {
      const transport = jest.fn().mockResolvedValue(wire);
      const api = createReservationReadApi(
        transport as ReservationReadApiTransport,
      );
      const signal = new AbortController().signal;

      await expect(
        api.getDetail(audience, RESERVATION_UID, { signal }),
      ).resolves.toMatchObject({ audience, reservationUid: RESERVATION_UID });
      expect(transport).toHaveBeenCalledWith({
        method: "GET",
        path,
        signal,
      });
      expect(transport.mock.calls[0][0]).not.toHaveProperty("params");
    },
  );

  it("rejects a path-shaped UID before transport", async () => {
    const transport = jest.fn();
    const api = createReservationReadApi(
      transport as ReservationReadApiTransport,
    );

    await expect(
      api.getDetail("guest", "..%2F..%2Fadmin"),
    ).rejects.toMatchObject({ code: "INVALID_OPAQUE_PATH_SEGMENT" });
    expect(transport).not.toHaveBeenCalled();
  });
});
