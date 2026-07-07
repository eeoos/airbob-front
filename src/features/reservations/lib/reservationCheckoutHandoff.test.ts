import { reservationApi } from "../../../api";
import {
  startReservationCheckoutHandoff,
  type AppliedReservationCheckoutCoupon,
} from "./reservationCheckoutHandoff";

const acceptAppliedCoupon = (coupon: AppliedReservationCheckoutCoupon) => coupon;

acceptAppliedCoupon({ id: 3, name: "만원 쿠폰", discount: 10000 });
// @ts-expect-error Applied coupon requires a non-null coupon id.
acceptAppliedCoupon({ id: null, name: "만원 쿠폰", discount: 10000 });
// @ts-expect-error Applied coupon requires a non-null coupon name.
acceptAppliedCoupon({ id: 3, name: null, discount: 10000 });

jest.mock("../../../api", () => ({
  reservationApi: {
    create: jest.fn(),
  },
}));

describe("reservation checkout handoff", () => {
  const reservationResponse = {
    reservation_uid: "reservation-123",
    order_name: "테스트 숙소 2박",
    amount: 190000,
    customer_email: "guest@example.com",
    customer_name: "게스트",
  };

  beforeEach(() => {
    sessionStorage.clear();
    jest.mocked(reservationApi.create).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a reservation with an explicit applied coupon object", async () => {
    const navigate = jest.fn();
    const events: string[] = [];
    const originalSetItem = Storage.prototype.setItem;
    jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        events.push(`set:${key}`);
        return originalSetItem.call(this, key, value);
    });
    navigate.mockImplementation(() => {
      events.push("navigate");
      expect(
        sessionStorage.getItem("airbob:reservation-checkout:7")
      ).not.toBeNull();
    });
    jest.mocked(reservationApi.create).mockResolvedValue(reservationResponse);

    const result = await startReservationCheckoutHandoff({
      accommodationId: 7,
      checkIn: new Date(2026, 6, 10),
      checkOut: new Date(2026, 6, 12),
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
      petCount: 1,
      appliedCoupon: {
        id: 3,
        name: "만원 쿠폰",
        discount: 10000,
      },
      navigate,
    });

    expect(reservationApi.create).toHaveBeenCalledWith({
      accommodation_id: 7,
      check_in_date: "2026-07-10",
      check_out_date: "2026-07-12",
      guest_count: 3,
      coupon_id: 3,
    });
    expect(result.checkoutState).toEqual(
      expect.objectContaining({
        reservationUid: "reservation-123",
        orderName: "테스트 숙소 2박",
        amount: 190000,
        customerEmail: "guest@example.com",
        customerName: "게스트",
        checkIn: "2026-07-10",
        checkOut: "2026-07-12",
        adultOccupancy: 2,
        childOccupancy: 1,
        infantOccupancy: 1,
        petOccupancy: 1,
        couponName: "만원 쿠폰",
        couponDiscount: 10000,
      })
    );
    expect(
      JSON.parse(sessionStorage.getItem("airbob:reservation-checkout:7") ?? "{}")
    ).toEqual(
      expect.objectContaining({
        reservationUid: "reservation-123",
        couponName: "만원 쿠폰",
        couponDiscount: 10000,
      })
    );
    expect(
      sessionStorage.getItem(
        "airbob:reservation-checkout-index:reservation-123"
      )
    ).toBe("7");
    expect(navigate).toHaveBeenCalledWith("/accommodations/7/confirm", {
      state: result.checkoutState,
    });
    expect(
      events.findIndex((event) =>
        event.startsWith("set:airbob:reservation-checkout:7")
      )
    ).toBeGreaterThanOrEqual(0);
    expect(
      events.findIndex((event) =>
        event.startsWith("set:airbob:reservation-checkout:7")
      )
    ).toBeLessThan(events.indexOf("navigate"));
  });

  it("creates a reservation without coupon fields when no coupon is applied", async () => {
    const navigate = jest.fn();
    jest.mocked(reservationApi.create).mockResolvedValue(reservationResponse);

    const result = await startReservationCheckoutHandoff({
      accommodationId: 7,
      checkIn: new Date(2026, 6, 10),
      checkOut: new Date(2026, 6, 12),
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      petCount: 0,
      appliedCoupon: null,
      navigate,
    });

    expect(reservationApi.create).toHaveBeenCalledWith({
      accommodation_id: 7,
      check_in_date: "2026-07-10",
      check_out_date: "2026-07-12",
      guest_count: 3,
    });
    expect(result.checkoutState).toEqual(
      expect.objectContaining({
        couponName: null,
        couponDiscount: null,
      })
    );
    expect(
      JSON.parse(sessionStorage.getItem("airbob:reservation-checkout:7") ?? "{}")
    ).toEqual(
      expect.objectContaining({
        couponName: null,
        couponDiscount: null,
      })
    );
    expect(navigate).toHaveBeenCalledWith("/accommodations/7/confirm", {
      state: result.checkoutState,
    });
  });
});
