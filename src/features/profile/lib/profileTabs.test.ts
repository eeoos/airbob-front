import {
  getActiveProfileTab,
  getGuestTripsFilterFromTab,
  getHostListingStatusFromTab,
  getHostReservationsFilterFromTab,
  getProfileTabForGuestTripsFilter,
  getProfileTabForHostListingStatus,
  getProfileTabForHostReservationsFilter,
  isHostListingTab,
  isHostReservationTab,
} from "./profileTabs";

describe("profile tab helpers", () => {
  it("maps route aliases to active UI tabs", () => {
    expect(getActiveProfileTab("trips")).toBe("upcoming");
    expect(getActiveProfileTab("listings")).toBe("listings-published");
    expect(getActiveProfileTab("reservations")).toBe("reservations-upcoming");
    expect(getActiveProfileTab("cancelled")).toBe("cancelled");
  });

  it("maps guest trip tabs to reservation filters", () => {
    expect(getGuestTripsFilterFromTab("trips")).toBe("UPCOMING");
    expect(getGuestTripsFilterFromTab("upcoming")).toBe("UPCOMING");
    expect(getGuestTripsFilterFromTab("past")).toBe("PAST");
    expect(getGuestTripsFilterFromTab("cancelled")).toBe("CANCELLED");
    expect(getProfileTabForGuestTripsFilter("PAST")).toBe("past");
  });

  it("maps host listing tabs to listing status filters", () => {
    expect(isHostListingTab("listings")).toBe(true);
    expect(isHostListingTab("reservations")).toBe(false);
    expect(getHostListingStatusFromTab("listings")).toBe("PUBLISHED");
    expect(getHostListingStatusFromTab("listings-draft")).toBe("DRAFT");
    expect(getHostListingStatusFromTab("listings-unpublished")).toBe("UNPUBLISHED");
    expect(getProfileTabForHostListingStatus("UNPUBLISHED")).toBe(
      "listings-unpublished"
    );
  });

  it("maps host reservation tabs to reservation filters", () => {
    expect(isHostReservationTab("reservations")).toBe(true);
    expect(isHostReservationTab("listings")).toBe(false);
    expect(getHostReservationsFilterFromTab("reservations")).toBe("UPCOMING");
    expect(getHostReservationsFilterFromTab("reservations-past")).toBe("PAST");
    expect(getHostReservationsFilterFromTab("reservations-cancelled")).toBe(
      "CANCELLED"
    );
    expect(getProfileTabForHostReservationsFilter("CANCELLED")).toBe(
      "reservations-cancelled"
    );
  });
});
