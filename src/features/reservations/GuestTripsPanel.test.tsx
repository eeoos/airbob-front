import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  GuestTripsPanel,
  type GuestTripsFilterType,
  type GuestTripsPanelProps,
} from "./GuestTripsPanel";
import styles from "./GuestTripsPanel.module.css";

const trip = {
  reservationUid: "reservation-11",
  accommodationName: "산장 숙소",
  thumbnailUrl: null,
  dateRangeLabel: "2026년 7월 10일 ~ 12일",
} as const;

const createProps = (
  overrides: Partial<GuestTripsPanelProps> = {},
): GuestTripsPanelProps => ({
  errorMessage: null,
  filterType: "UPCOMING",
  getReservationHref: (reservationUid) => `/reservations/${reservationUid}`,
  loadMoreRef: vi.fn(),
  onDismissError: vi.fn(),
  onOpenReservation: vi.fn(),
  state: {
    status: "ready",
    groups: [],
    hasNext: false,
    isLoadingMore: false,
  },
  ...overrides,
});

describe("GuestTripsPanel", () => {
  it("renders only the shared loading state while loading", () => {
    render(
      <GuestTripsPanel {...createProps({ state: { status: "loading" } })} />,
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
    expect(screen.queryByText("다가올 여행")).not.toBeInTheDocument();
  });

  it.each<[GuestTripsFilterType, string]>([
    ["UPCOMING", "다가올 여행"],
    ["PAST", "이전 여행"],
    ["CANCELLED", "취소된 여행"],
  ])("renders the %s heading and existing empty copy", (filterType, title) => {
    render(<GuestTripsPanel {...createProps({ filterType })} />);

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(
      screen.getByText("아직 예약한 여행이 없습니다."),
    ).toBeInTheDocument();
  });

  it("renders grouped navigation cards and delegates plain primary clicks", () => {
    const onOpenReservation = vi.fn();

    render(
      <GuestTripsPanel
        {...createProps({
          onOpenReservation,
          state: {
            status: "ready",
            groups: [{ year: 2026, trips: [trip] }],
            hasNext: false,
            isLoadingMore: false,
          },
        })}
      />,
    );

    expect(screen.getByRole("heading", { name: "2026" })).toBeInTheDocument();
    expect(screen.getByText("🏠")).toBeInTheDocument();
    expect(screen.getByText("2026년 7월 10일 ~ 12일")).toBeInTheDocument();

    const card = screen.getByRole("link", {
      name: "산장 숙소 예약 상세 보기",
    });
    const article = screen.getByRole("article");

    expect(card).toHaveAttribute("href", "/reservations/reservation-11");
    expect(article).toHaveClass(styles.reservationCard ?? "");
    expect(card).not.toContainElement(screen.getByText("산장 숙소"));

    const click = createEvent.click(card, { button: 0 });
    fireEvent(card, click);

    expect(click.defaultPrevented).toBe(true);
    expect(onOpenReservation).toHaveBeenCalledWith("reservation-11");
  });

  it("preserves browser navigation for modified and new-tab clicks", () => {
    const onOpenReservation = vi.fn();

    render(
      <GuestTripsPanel
        {...createProps({
          onOpenReservation,
          state: {
            status: "ready",
            groups: [{ year: 2026, trips: [trip] }],
            hasNext: false,
            isLoadingMore: false,
          },
        })}
      />,
    );
    const card = screen.getByRole("link", {
      name: "산장 숙소 예약 상세 보기",
    });
    const modifiedClick = createEvent.click(card, {
      button: 0,
      metaKey: true,
    });
    const newTabClick = createEvent.click(card, { button: 1 });

    fireEvent(card, modifiedClick);
    fireEvent(card, newTabClick);

    expect(modifiedClick.defaultPrevented).toBe(false);
    expect(newTabClick.defaultPrevented).toBe(false);
    expect(onOpenReservation).not.toHaveBeenCalled();
  });

  it("preserves infinite-load and dismissible error behavior", async () => {
    const loadMoreRef = vi.fn();
    const onDismissError = vi.fn();

    render(
      <GuestTripsPanel
        {...createProps({
          errorMessage: "예약을 불러오지 못했습니다.",
          loadMoreRef,
          onDismissError,
          state: {
            status: "ready",
            groups: [{ year: 2026, trips: [trip] }],
            hasNext: true,
            isLoadingMore: true,
          },
        })}
      />,
    );

    expect(loadMoreRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "예약을 불러오지 못했습니다.",
    );

    await userEvent.click(screen.getByRole("button", { name: "오류 닫기" }));
    expect(onDismissError).toHaveBeenCalledTimes(1);
  });
});
