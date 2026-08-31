import type { SearchPlaceSelection } from "./search";

export type SearchActivePopover = "none" | "destination" | "date" | "guests";
export type SearchShellState = "compact" | "expanded";
export type SearchCompositionPhase = "idle" | "composing";
export type SearchBottomSheetState = "collapsed" | "half" | "expanded";
export type SearchGuestKey =
  "adultOccupancy" | "childOccupancy" | "infantOccupancy" | "petOccupancy";

export interface SearchGuestCounts {
  adultOccupancy: number;
  childOccupancy: number;
  infantOccupancy: number;
  petOccupancy: number;
}

export interface SearchCommittedValues extends SearchGuestCounts {
  destination: string;
  checkIn: Date | null;
  checkOut: Date | null;
}

export interface SearchInteractionDraft extends SearchGuestCounts {
  destinationText: string;
  selectedPlace: SearchPlaceSelection | null;
  checkIn: Date | null;
  checkOut: Date | null;
}

export interface SearchInteractionState {
  draft: SearchInteractionDraft;
  shell: SearchShellState;
  activePopover: SearchActivePopover;
  composition: SearchCompositionPhase;
  bottomSheet: SearchBottomSheetState;
}

export type SearchInteractionEvent =
  | { type: "committedChanged"; values: SearchCommittedValues }
  | { type: "destinationTextChanged"; value: string }
  | { type: "destinationSelected"; place: SearchPlaceSelection }
  | { type: "destinationSelectionCleared" }
  | { type: "dateRangeChanged"; checkIn: Date | null; checkOut: Date | null }
  | { type: "checkoutCompleted" }
  | { type: "guestCountChanged"; guest: SearchGuestKey; value: number }
  | { type: "shellExpanded" }
  | { type: "shellCollapsed" }
  | {
      type: "popoverOpened";
      popover: Exclude<SearchActivePopover, "none">;
    }
  | {
      type: "popoverToggled";
      popover: Exclude<SearchActivePopover, "none">;
    }
  | { type: "popoverClosed" }
  | { type: "compositionStarted" }
  | { type: "compositionEnded" }
  | { type: "bottomSheetSet"; state: SearchBottomSheetState }
  | { type: "bottomSheetStepped"; direction: "up" | "down" }
  | { type: "bottomSheetMapInteracted" }
  | { type: "bottomSheetContentScrolled" };

const DEFAULT_COMMITTED_VALUES: SearchCommittedValues = {
  destination: "",
  checkIn: null,
  checkOut: null,
  adultOccupancy: 1,
  childOccupancy: 0,
  infantOccupancy: 0,
  petOccupancy: 0,
};

const normalizeDate = (value: Date | null): Date | null => {
  if (!value || !Number.isFinite(value.getTime())) {
    return null;
  }

  return new Date(value.getTime());
};

const normalizeDateRange = (
  checkInValue: Date | null,
  checkOutValue: Date | null,
) => {
  const checkIn = normalizeDate(checkInValue);
  const checkOut = normalizeDate(checkOutValue);

  if (checkIn && checkOut && checkOut.getTime() < checkIn.getTime()) {
    return { checkIn: checkOut, checkOut: checkIn };
  }

  return { checkIn, checkOut };
};

const normalizeGuestCount = (guest: SearchGuestKey, value: number) => {
  const minimum = guest === "adultOccupancy" ? 1 : 0;

  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(minimum, Math.trunc(value));
};

const normalizeCommittedValues = (
  values: SearchCommittedValues,
): SearchInteractionDraft => {
  const dates = normalizeDateRange(values.checkIn, values.checkOut);

  return {
    destinationText: values.destination,
    selectedPlace: null,
    ...dates,
    adultOccupancy: normalizeGuestCount(
      "adultOccupancy",
      values.adultOccupancy,
    ),
    childOccupancy: normalizeGuestCount(
      "childOccupancy",
      values.childOccupancy,
    ),
    infantOccupancy: normalizeGuestCount(
      "infantOccupancy",
      values.infantOccupancy,
    ),
    petOccupancy: normalizeGuestCount("petOccupancy", values.petOccupancy),
  };
};

export const createSearchInteractionState = (
  committedValues: SearchCommittedValues = DEFAULT_COMMITTED_VALUES,
): SearchInteractionState => ({
  draft: normalizeCommittedValues(committedValues),
  shell: "compact",
  activePopover: "none",
  composition: "idle",
  bottomSheet: "half",
});

export const getNextSearchBottomSheetState = (
  currentState: SearchBottomSheetState,
  direction: "up" | "down",
): SearchBottomSheetState => {
  if (direction === "up") {
    if (currentState === "collapsed") return "half";
    if (currentState === "half") return "expanded";
    return currentState;
  }

  if (currentState === "expanded") return "half";
  if (currentState === "half") return "collapsed";
  return currentState;
};

export const searchInteractionReducer = (
  state: SearchInteractionState,
  event: SearchInteractionEvent,
): SearchInteractionState => {
  switch (event.type) {
    case "committedChanged":
      return {
        ...state,
        draft: normalizeCommittedValues(event.values),
      };
    case "destinationTextChanged":
      return {
        ...state,
        draft: {
          ...state.draft,
          destinationText: event.value,
          selectedPlace: null,
        },
      };
    case "destinationSelected":
      return {
        ...state,
        draft: { ...state.draft, selectedPlace: event.place },
        activePopover: "none",
      };
    case "destinationSelectionCleared":
      return {
        ...state,
        draft: {
          ...state.draft,
          destinationText: "",
          selectedPlace: null,
        },
      };
    case "dateRangeChanged":
      return {
        ...state,
        draft: {
          ...state.draft,
          ...normalizeDateRange(event.checkIn, event.checkOut),
        },
      };
    case "checkoutCompleted": {
      if (!state.draft.checkIn || state.draft.checkOut) {
        return state;
      }

      const checkOut = new Date(state.draft.checkIn.getTime());
      checkOut.setDate(checkOut.getDate() + 1);

      return {
        ...state,
        draft: { ...state.draft, checkOut },
      };
    }
    case "guestCountChanged":
      return {
        ...state,
        draft: {
          ...state.draft,
          [event.guest]: normalizeGuestCount(event.guest, event.value),
        },
      };
    case "shellExpanded":
      return state.shell === "expanded"
        ? state
        : { ...state, shell: "expanded" };
    case "shellCollapsed":
      return {
        ...state,
        shell: "compact",
        activePopover: "none",
        composition: "idle",
      };
    case "popoverOpened":
      return {
        ...state,
        shell: "expanded",
        activePopover: event.popover,
      };
    case "popoverToggled":
      return {
        ...state,
        shell: "expanded",
        activePopover:
          state.activePopover === event.popover ? "none" : event.popover,
      };
    case "popoverClosed":
      return state.activePopover === "none"
        ? state
        : { ...state, activePopover: "none" };
    case "compositionStarted":
      return { ...state, composition: "composing" };
    case "compositionEnded":
      return { ...state, composition: "idle" };
    case "bottomSheetSet":
      return { ...state, bottomSheet: event.state };
    case "bottomSheetStepped":
      return {
        ...state,
        bottomSheet: getNextSearchBottomSheetState(
          state.bottomSheet,
          event.direction,
        ),
      };
    case "bottomSheetMapInteracted":
      return { ...state, bottomSheet: "collapsed" };
    case "bottomSheetContentScrolled":
      return state.bottomSheet === "expanded"
        ? state
        : { ...state, bottomSheet: "expanded" };
  }
};
