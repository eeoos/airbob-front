import { fireEvent, renderHook, screen } from "@testing-library/react";
import type { MockInstance } from "vitest";
import { useMapInfoWindowEvents } from "./useMapInfoWindowEvents";

describe("useMapInfoWindowEvents", () => {
  let openSpy: MockInstance<typeof window.open>;

  beforeEach(() => {
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
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
        getAccommodationHref: (id) =>
          `/accommodations/${id}?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2`,
      }),
    );

    const cleanup = result.current({
      root,
      accommodationId: 10,
      onClose: vi.fn(),
    });

    fireEvent.click(screen.getByText("card body"));

    expect(openSpy).toHaveBeenCalledWith(
      "/accommodations/10?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2",
      "_blank",
      "noopener,noreferrer",
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
    const onClose = vi.fn();
    const onWishlistToggle = vi.fn();

    const { result } = renderHook(() =>
      useMapInfoWindowEvents({
        getAccommodationHref: (id) => `/accommodations/${id}`,
        onWishlistToggle,
      }),
    );

    result.current({
      root,
      accommodationId: 10,
      onClose,
    });

    fireEvent.click(screen.getByText("heart"));

    expect(onWishlistToggle).toHaveBeenCalledWith(10, true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalled();
  });
});
