import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccommodationActionModalProps } from "../../features/accommodations/components/AccommodationActionModal/AccommodationActionModal";
import type { HostListingsPanelProps } from "../../features/profile/HostListingsPanel";
import type { GuestTripsPanelProps } from "../../features/reservations/GuestTripsPanel";
import type { HostReservationsPanelProps } from "../../features/reservations/HostReservationsPanel";
import { ProfileScreen } from "./ProfileScreen";

const guestTrips = (
  overrides: Partial<GuestTripsPanelProps> = {},
): GuestTripsPanelProps => ({
  errorMessage: null,
  filterType: "UPCOMING",
  getReservationHref: (reservationUid) =>
    `/reservations/${reservationUid}`,
  loadMoreRef: jest.fn(),
  onDismissError: jest.fn(),
  onOpenReservation: jest.fn(),
  state: {
    status: "ready",
    hasNext: false,
    isLoadingMore: false,
    groups: [
      {
        year: 2026,
        trips: [
          {
            reservationUid: "guest-reservation-1",
            accommodationName: "게스트 숙소",
            thumbnailUrl: null,
            dateRangeLabel: "2026년 8월 1일 ~ 3일",
          },
        ],
      },
    ],
  },
  ...overrides,
});

const hostListings = (
  overrides: Partial<HostListingsPanelProps> = {},
): HostListingsPanelProps => ({
  errorMessage: null,
  loadMoreRef: jest.fn(),
  onDismissError: jest.fn(),
  onOpenListingActions: jest.fn(),
  onStatusChange: jest.fn(),
  state: {
    status: "ready",
    hasNext: false,
    isLoadingMore: false,
    listings: [
      {
        id: 7,
        imageAlt: "호스트 숙소",
        locationLabel: "서울, 마포구",
        managementLabel: "호스트 숙소 숙소 관리 열기",
        name: "호스트 숙소",
        statusLabel: "공개",
        thumbnailUrl: null,
      },
    ],
  },
  statusType: "PUBLISHED",
  ...overrides,
});

const accommodationAction = (
  overrides: Partial<AccommodationActionModalProps> = {},
): AccommodationActionModalProps => ({
  accommodation: {
    canOpenDetail: true,
    canPublish: false,
    canUnpublish: true,
    id: 7,
    imageAlt: "호스트 숙소",
    name: "호스트 숙소",
    thumbnailUrl: null,
  },
  errorMessage: null,
  isPending: false,
  onClose: jest.fn(),
  onDelete: jest.fn(),
  onDismissError: jest.fn(),
  onEdit: jest.fn(),
  onOpenDetail: jest.fn(),
  onPublish: jest.fn(),
  onUnpublish: jest.fn(),
  ...overrides,
});

const hostReservations = (
  overrides: Partial<HostReservationsPanelProps> = {},
): HostReservationsPanelProps => ({
  checkInSortDirection: "descending",
  errorMessage: null,
  filterType: "UPCOMING",
  loadMoreRef: jest.fn(),
  onCheckInSort: jest.fn(),
  onDismissError: jest.fn(),
  onFilterChange: jest.fn(),
  onOpenReservation: jest.fn(),
  state: {
    status: "ready",
    hasNext: false,
    isLoadingMore: false,
    rows: [
      {
        reservationUid: "host-reservation-1",
        statusLabel: "확정됨",
        statusTone: "success",
        guestName: "게스트",
        guestCountLabel: "2명",
        checkInLabel: "2026년 8월 1일",
        checkOutLabel: "2026년 8월 3일",
        createdAtLabel: "2026년 7월 1일",
        accommodationName: "호스트 숙소",
        reservationCodeLabel: "CODE-1",
        totalPriceLabel: "₩200,000",
      },
    ],
  },
  ...overrides,
});

describe("ProfileScreen", () => {
  it("composes the guest shell and mapped trip callbacks", async () => {
    const onModeChange = jest.fn();
    const onOpenReservation = jest.fn();
    const onTabChange = jest.fn();

    render(
      <ProfileScreen
        variant="guest"
        activeTab="upcoming"
        guestTrips={guestTrips({ onOpenReservation })}
        onModeChange={onModeChange}
        onTabChange={onTabChange}
      />,
    );

    expect(screen.getByText("프로필")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "다가올 여행" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("link", {
        name: "게스트 숙소 예약 상세 보기",
      }),
    );
    await userEvent.click(screen.getByRole("tab", { name: "이전 여행" }));
    await userEvent.click(screen.getByRole("tab", { name: "호스트" }));

    expect(onOpenReservation).toHaveBeenCalledWith("guest-reservation-1");
    expect(onTabChange).toHaveBeenCalledWith("past");
    expect(onModeChange).toHaveBeenCalledWith("host");
  });

  it("composes host listings with controller-owned selection and action state", async () => {
    const onDelete = jest.fn();
    const onOpenListingActions = jest.fn();
    const onSectionChange = jest.fn();

    render(
      <ProfileScreen
        variant="host-listings"
        accommodationAction={accommodationAction({
          isPending: true,
          onDelete,
        })}
        hostListings={hostListings({ onOpenListingActions })}
        onModeChange={jest.fn()}
        onSectionChange={onSectionChange}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "호스트 숙소 숙소 관리 열기",
      }),
    );
    expect(onOpenListingActions).toHaveBeenCalledWith(7);

    expect(screen.getByRole("dialog", { name: "숙소 관리" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "리스팅 삭제" })).toBeDisabled();

    await userEvent.click(screen.getByRole("tab", { name: "예약 관리" }));
    expect(onSectionChange).toHaveBeenCalledWith("reservations");
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("composes host reservations and delegates row navigation", async () => {
    const onOpenReservation = jest.fn();

    render(
      <ProfileScreen
        variant="host-reservations"
        hostReservations={hostReservations({ onOpenReservation })}
        onModeChange={jest.fn()}
        onSectionChange={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "예약 관리" }),
    ).toBeInTheDocument();
    expect(screen.getByText("CODE-1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "상세" }));

    expect(onOpenReservation).toHaveBeenCalledWith("host-reservation-1");
  });
});
