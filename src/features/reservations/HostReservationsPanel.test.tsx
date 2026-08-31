import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  HostReservationsPanel,
  type HostReservationRowView,
  type HostReservationsPanelProps,
} from "./HostReservationsPanel";

const reservationRow: HostReservationRowView = {
  reservationUid: "host-1",
  statusLabel: "결제 완료",
  statusTone: "success",
  guestName: "게스트 1",
  guestCountLabel: "2명",
  checkInLabel: "2026년 7월 11일 (토)",
  checkOutLabel: "2026년 7월 13일 (월)",
  createdAtLabel: "2026년 7월 1일 (수)",
  accommodationName: "숙소 1",
  reservationCodeLabel: "CODE-1",
  totalPriceLabel: "₩100,001",
};

const createProps = (
  overrides: Partial<HostReservationsPanelProps> = {},
): HostReservationsPanelProps => ({
  checkInSortDirection: "descending",
  errorMessage: null,
  filterType: "UPCOMING",
  loadMoreRef: vi.fn(),
  onCheckInSort: vi.fn(),
  onDismissError: vi.fn(),
  onFilterChange: vi.fn(),
  onOpenReservation: vi.fn(),
  state: {
    status: "ready",
    rows: [],
    hasNext: false,
    isLoadingMore: false,
  },
  ...overrides,
});

describe("HostReservationsPanel", () => {
  it("renders only the shared loading state while loading", () => {
    render(
      <HostReservationsPanel
        {...createProps({ state: { status: "loading" } })}
      />,
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
    expect(screen.queryByText("예약 관리")).not.toBeInTheDocument();
  });

  it("preserves filters, empty copy, and dismissible error toast", async () => {
    const onDismissError = vi.fn();
    const onFilterChange = vi.fn();

    render(
      <HostReservationsPanel
        {...createProps({
          errorMessage: "예약을 불러오지 못했습니다.",
          onDismissError,
          onFilterChange,
        })}
      />,
    );

    expect(screen.getByText("예약 관리")).toBeInTheDocument();
    expect(screen.getByText("아직 예약이 없습니다.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "취소된 예약" }));
    expect(onFilterChange).toHaveBeenCalledWith("CANCELLED");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "예약을 불러오지 못했습니다.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "오류 닫기" }),
    );
    expect(onDismissError).toHaveBeenCalledTimes(1);
  });

  it("renders mapped rows and delegates detail navigation", async () => {
    const onOpenReservation = vi.fn();

    render(
      <HostReservationsPanel
        {...createProps({
          onOpenReservation,
          state: {
            status: "ready",
            hasNext: false,
            isLoadingMore: false,
            rows: [
              reservationRow,
              {
                ...reservationRow,
                reservationUid: "host-2",
                reservationCodeLabel: "CODE-2",
                statusLabel: "이용 완료",
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText("결제 완료")).toBeInTheDocument();
    expect(screen.getByText("이용 완료")).toBeInTheDocument();
    expect(screen.getAllByText("게스트 1")).toHaveLength(2);
    expect(screen.getAllByText("₩100,001")).toHaveLength(2);

    const firstDetailButton = screen
      .getAllByRole("button", { name: "상세" })
      .at(0);
    if (!firstDetailButton) throw new Error("Expected a reservation detail button");
    await userEvent.click(firstDetailButton);

    expect(onOpenReservation).toHaveBeenCalledWith("host-1");
  });

  it("keeps check-in sorting controlled and keyboard accessible", async () => {
    const onCheckInSort = vi.fn();
    const props = createProps({
      onCheckInSort,
      state: {
        status: "ready",
        rows: [reservationRow],
        hasNext: false,
        isLoadingMore: false,
      },
    });
    const { rerender } = render(<HostReservationsPanel {...props} />);

    const sortButton = screen.getByRole("button", { name: /체크인/ });
    const checkInHeader = screen.getByRole("columnheader", { name: /체크인/ });

    expect(checkInHeader).toHaveAttribute("aria-sort", "descending");
    expect(sortButton).toHaveTextContent("↓");

    sortButton.focus();
    await userEvent.keyboard("{Enter}");

    expect(onCheckInSort).toHaveBeenCalledTimes(1);

    rerender(
      <HostReservationsPanel
        {...props}
        checkInSortDirection="ascending"
      />,
    );

    expect(checkInHeader).toHaveAttribute("aria-sort", "ascending");
    expect(sortButton).toHaveTextContent("↑");
  });

  it("attaches the injected load-more ref for nonempty paginated tables", () => {
    const loadMoreRef = vi.fn();

    render(
      <HostReservationsPanel
        {...createProps({
          loadMoreRef,
          state: {
            status: "ready",
            rows: [reservationRow],
            hasNext: true,
            isLoadingMore: true,
          },
        })}
      />,
    );

    expect(loadMoreRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });
});
