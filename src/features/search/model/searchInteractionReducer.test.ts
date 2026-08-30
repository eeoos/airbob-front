import {
  createSearchInteractionState,
  searchInteractionReducer,
  type SearchActivePopover,
} from "./searchInteractionReducer";

const dateKey = (value: Date | null) =>
  value
    ? `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`
    : null;

describe("searchInteractionReducer", () => {
  it.each([
    ["destination", "date"],
    ["destination", "guests"],
    ["date", "destination"],
    ["date", "guests"],
    ["guests", "destination"],
    ["guests", "date"],
  ] as const)(
    "replaces %s with %s so only one popover can be active",
    (currentPopover, nextPopover) => {
      const current = searchInteractionReducer(
        createSearchInteractionState(),
        { type: "popoverOpened", popover: currentPopover },
      );
      const next = searchInteractionReducer(current, {
        type: "popoverOpened",
        popover: nextPopover,
      });

      expect(next.shell).toBe("expanded");
      expect(next.activePopover).toBe(nextPopover);
    },
  );

  it.each(["destination", "date", "guests"] as const)(
    "toggles the %s popover without affecting the expanded shell",
    (popover) => {
      const opened = searchInteractionReducer(
        createSearchInteractionState(),
        { type: "popoverToggled", popover },
      );
      const closed = searchInteractionReducer(opened, {
        type: "popoverToggled",
        popover,
      });

      expect(opened.activePopover).toBe(popover);
      expect(closed.activePopover).toBe("none");
      expect(closed.shell).toBe("expanded");
    },
  );

  it("atomically hydrates validated committed values without changing interaction state", () => {
    const activeDraft = {
      ...createSearchInteractionState(),
      shell: "expanded" as const,
      activePopover: "destination" as SearchActivePopover,
      composition: "composing" as const,
    };

    const next = searchInteractionReducer(activeDraft, {
      type: "committedChanged",
      values: {
        destination: "Busan",
        checkIn: new Date(2026, 6, 12),
        checkOut: new Date(2026, 6, 10),
        adultOccupancy: 0,
        childOccupancy: -1,
        infantOccupancy: Number.NaN,
        petOccupancy: 2.8,
      },
    });

    expect(next.draft.destinationText).toBe("Busan");
    expect(dateKey(next.draft.checkIn)).toBe("2026-7-10");
    expect(dateKey(next.draft.checkOut)).toBe("2026-7-12");
    expect(next.draft).toEqual(
      expect.objectContaining({
        selectedPlace: null,
        adultOccupancy: 1,
        childOccupancy: 0,
        infantOccupancy: 0,
        petOccupancy: 2,
      }),
    );
    expect(next.shell).toBe("expanded");
    expect(next.activePopover).toBe("destination");
    expect(next.composition).toBe("composing");
  });

  it("clears a selected place whenever destination text becomes a draft again", () => {
    const selected = searchInteractionReducer(
      createSearchInteractionState(),
      {
        type: "destinationSelected",
        place: {
          lat: 37.5,
          lng: 127,
          viewport: { north: 38, south: 37, east: 128, west: 126 },
        },
      },
    );

    const changed = searchInteractionReducer(selected, {
      type: "destinationTextChanged",
      value: "Seoul cafe",
    });

    expect(changed.draft.destinationText).toBe("Seoul cafe");
    expect(changed.draft.selectedPlace).toBeNull();
  });

  it("normalizes reversed dates and completes an unfinished checkout", () => {
    const selected = searchInteractionReducer(
      createSearchInteractionState(),
      {
        type: "dateRangeChanged",
        checkIn: new Date(2026, 6, 12),
        checkOut: new Date(2026, 6, 10),
      },
    );

    expect(dateKey(selected.draft.checkIn)).toBe("2026-7-10");
    expect(dateKey(selected.draft.checkOut)).toBe("2026-7-12");

    const unfinished = searchInteractionReducer(selected, {
      type: "dateRangeChanged",
      checkIn: new Date(2026, 6, 20),
      checkOut: null,
    });
    const completed = searchInteractionReducer(unfinished, {
      type: "checkoutCompleted",
    });

    expect(dateKey(completed.draft.checkOut)).toBe("2026-7-21");
  });

  it("uses the same reducer transitions for the bottom sheet projection", () => {
    const initial = createSearchInteractionState();
    const expanded = searchInteractionReducer(initial, {
      type: "bottomSheetStepped",
      direction: "up",
    });
    const half = searchInteractionReducer(expanded, {
      type: "bottomSheetStepped",
      direction: "down",
    });
    const collapsed = searchInteractionReducer(half, {
      type: "bottomSheetMapInteracted",
    });
    const scrolled = searchInteractionReducer(collapsed, {
      type: "bottomSheetContentScrolled",
    });

    expect(expanded.bottomSheet).toBe("expanded");
    expect(half.bottomSheet).toBe("half");
    expect(collapsed.bottomSheet).toBe("collapsed");
    expect(scrolled.bottomSheet).toBe("expanded");
  });
});
