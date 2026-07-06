import { renderHook } from "@testing-library/react";
import { useMapInfoWindowEvents } from "./useMapInfoWindowEvents";

describe("useMapInfoWindowEvents", () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
    document.body.innerHTML = "";
  });

  it("opens accommodation detail in a new tab with booking-safe params", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>card body</p>";
    document.body.appendChild(root);

    const { result } = renderHook(() =>
      useMapInfoWindowEvents({
        detailSearchParams: new URLSearchParams(
          "checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&page=9",
        ),
      }),
    );

    const cleanup = result.current({
      root,
      accommodationId: 10,
      onClose: jest.fn(),
    });

    root.querySelector("p")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    expect(openSpy).toHaveBeenCalledWith(
      "/accommodations/10?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2",
      "_blank",
    );

    cleanup();
  });

  it("toggles wishlist with the clicked accommodation id and then closes", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button
        type="button"
        data-info-window-action="wishlist"
        data-accommodation-id="10"
        data-is-in-wishlist="true"
      >
        <span>heart</span>
      </button>
    `;
    document.body.appendChild(root);
    const onClose = jest.fn();
    const onWishlistToggle = jest.fn();

    const { result } = renderHook(() =>
      useMapInfoWindowEvents({
        onWishlistToggle,
      }),
    );

    result.current({
      root,
      accommodationId: 10,
      onClose,
    });

    root.querySelector("span")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    expect(onWishlistToggle).toHaveBeenCalledWith(10, true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalled();
  });
});
