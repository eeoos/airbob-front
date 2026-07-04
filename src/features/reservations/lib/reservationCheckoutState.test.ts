import {
  clearAllReservationCheckoutState,
  clearReservationCheckoutState,
  clearReservationCheckoutStateByReservationUid,
  getReservationCheckoutAccommodationId,
  readReservationCheckoutState,
  saveReservationCheckoutState,
} from "./reservationCheckoutState";
import type { ReservationCheckoutState } from "./reservationCheckoutState";

const checkoutState: ReservationCheckoutState = {
  reservationUid: "reservation-123",
  orderName: "테스트 주문",
  amount: 120000,
  customerEmail: "guest@example.com",
  customerName: "게스트",
  checkIn: "2026-07-20",
  checkOut: "2026-07-22",
  adultOccupancy: 2,
  childOccupancy: 1,
  infantOccupancy: 0,
  petOccupancy: 1,
  couponName: "만원 쿠폰",
  couponDiscount: 10000,
};

describe("reservation checkout state", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("falls back to saved checkout state from sessionStorage when location state is missing", () => {
    saveReservationCheckoutState("7", checkoutState);

    expect(readReservationCheckoutState("7", null)).toEqual(checkoutState);
  });

  it("uses location state before sessionStorage fallback", () => {
    saveReservationCheckoutState("7", checkoutState);
    const locationState: ReservationCheckoutState = {
      ...checkoutState,
      reservationUid: "reservation-from-location",
      orderName: "라우터 주문",
      amount: 90000,
    };

    expect(readReservationCheckoutState("7", locationState)).toEqual(locationState);
  });

  it("ignores partial location state and returns the saved fallback", () => {
    saveReservationCheckoutState("7", checkoutState);

    expect(
      readReservationCheckoutState("7", {
        reservationUid: "partial-location",
      })
    ).toEqual(checkoutState);
  });

  it("ignores wrong-typed location state and returns the saved fallback", () => {
    saveReservationCheckoutState("7", checkoutState);

    expect(
      readReservationCheckoutState("7", {
        ...checkoutState,
        amount: "120000",
      })
    ).toEqual(checkoutState);
  });

  it("returns null when wrong-typed location state has no valid stored fallback", () => {
    expect(
      readReservationCheckoutState("7", {
        ...checkoutState,
        amount: "120000",
      })
    ).toBeNull();
  });

  it("returns null when saved checkout state is malformed JSON", () => {
    sessionStorage.setItem("airbob:reservation-checkout:7", "{");

    expect(readReservationCheckoutState("7", null)).toBeNull();
  });

  it("returns null when saved checkout state has wrong field types", () => {
    sessionStorage.setItem(
      "airbob:reservation-checkout:7",
      JSON.stringify({
        ...checkoutState,
        amount: "120000",
      })
    );

    expect(readReservationCheckoutState("7", null)).toBeNull();
  });

  it("does not throw and returns null when sessionStorage getItem throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });

    expect(() => readReservationCheckoutState("7", null)).not.toThrow();
    expect(readReservationCheckoutState("7", null)).toBeNull();
  });

  it("removes the saved fallback checkout state", () => {
    saveReservationCheckoutState("7", checkoutState);

    clearReservationCheckoutState("7");

    expect(readReservationCheckoutState("7", null)).toBeNull();
  });

  it("indexes saved checkout state by reservationUid", () => {
    saveReservationCheckoutState("7", checkoutState);

    expect(getReservationCheckoutAccommodationId("reservation-123")).toBe("7");
  });

  it("rolls back the primary fallback when reservationUid index write fails", () => {
    const originalSetItem = Storage.prototype.setItem;

    jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === "airbob:reservation-checkout-index:reservation-123") {
          throw new Error("index write failed");
        }

        return originalSetItem.call(this, key, value);
      });

    saveReservationCheckoutState("7", checkoutState);

    expect(readReservationCheckoutState("7", null)).toBeNull();
    expect(getReservationCheckoutAccommodationId("reservation-123")).toBeNull();
  });

  it("removes the previous reservationUid index when overwriting the same accommodation checkout", () => {
    const updatedCheckoutState: ReservationCheckoutState = {
      ...checkoutState,
      reservationUid: "reservation-456",
      orderName: "변경된 주문",
    };

    saveReservationCheckoutState("7", checkoutState);
    saveReservationCheckoutState("7", updatedCheckoutState);

    expect(readReservationCheckoutState("7", null)).toEqual(updatedCheckoutState);
    expect(getReservationCheckoutAccommodationId("reservation-123")).toBeNull();
    expect(getReservationCheckoutAccommodationId("reservation-456")).toBe("7");
  });

  it("removes the reservationUid index when clearing checkout state by accommodationId", () => {
    saveReservationCheckoutState("7", checkoutState);

    clearReservationCheckoutState("7");

    expect(getReservationCheckoutAccommodationId("reservation-123")).toBeNull();
  });

  it("clears saved checkout state and index by reservationUid", () => {
    saveReservationCheckoutState("7", checkoutState);

    clearReservationCheckoutStateByReservationUid("reservation-123");

    expect(readReservationCheckoutState("7", null)).toBeNull();
    expect(getReservationCheckoutAccommodationId("reservation-123")).toBeNull();
  });

  it("does not clear a current checkout fallback when clearing by stale reservationUid index", () => {
    const currentCheckoutState: ReservationCheckoutState = {
      ...checkoutState,
      reservationUid: "reservation-current",
    };

    saveReservationCheckoutState("7", currentCheckoutState);
    sessionStorage.setItem(
      "airbob:reservation-checkout-index:reservation-stale",
      "7"
    );

    clearReservationCheckoutStateByReservationUid("reservation-stale");

    expect(readReservationCheckoutState("7", null)).toEqual(currentCheckoutState);
    expect(getReservationCheckoutAccommodationId("reservation-stale")).toBeNull();
    expect(getReservationCheckoutAccommodationId("reservation-current")).toBe("7");
  });

  it("does not throw when clearing by reservationUid and removeItem throws", () => {
    saveReservationCheckoutState("7", checkoutState);
    jest.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("remove failed");
    });

    expect(() =>
      clearReservationCheckoutStateByReservationUid("reservation-123")
    ).not.toThrow();
  });

  it("clears every reservation checkout storage key without touching unrelated session data", () => {
    saveReservationCheckoutState("7", checkoutState);
    saveReservationCheckoutState("8", {
      ...checkoutState,
      reservationUid: "reservation-456",
    });
    sessionStorage.setItem("airbob:unrelated", "keep");
    sessionStorage.setItem("third-party", "keep");

    clearAllReservationCheckoutState();

    expect(readReservationCheckoutState("7", null)).toBeNull();
    expect(readReservationCheckoutState("8", null)).toBeNull();
    expect(getReservationCheckoutAccommodationId("reservation-123")).toBeNull();
    expect(getReservationCheckoutAccommodationId("reservation-456")).toBeNull();
    expect(sessionStorage.getItem("airbob:unrelated")).toBe("keep");
    expect(sessionStorage.getItem("third-party")).toBe("keep");
  });

  it("does not throw when clearing all checkout state and sessionStorage.key throws", () => {
    saveReservationCheckoutState("7", checkoutState);
    jest.spyOn(Storage.prototype, "key").mockImplementation(() => {
      throw new Error("storage denied");
    });

    expect(clearAllReservationCheckoutState).not.toThrow();
  });
});
