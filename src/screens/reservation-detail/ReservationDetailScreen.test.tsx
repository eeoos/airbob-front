import { readFileSync } from "node:fs";
import type { Mocked } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  ReservationDetailScreen,
  type GuestReservationDetailActions,
  type GuestReservationDetailView,
  type HostReservationDetailActions,
  type HostReservationDetailView,
} from "./ReservationDetailScreen";

const guestActions: Mocked<GuestReservationDetailActions> = {
  onBack: vi.fn(),
  onBackToProfile: vi.fn(),
  onDismissError: vi.fn(),
  onDismissFeedback: vi.fn(),
  onOpenAccommodation: vi.fn(),
  onOpenReview: vi.fn(),
};

const hostActions: Mocked<HostReservationDetailActions> = {
  onBack: vi.fn(),
  onOpenAccommodation: vi.fn(),
  onRetry: vi.fn(),
};

const guestView: GuestReservationDetailView = {
  reservationUid: "reservation-123",
  reservationCode: "CODE-123",
  guestCountLabel: "게스트 2명",
  accommodation: {
    id: 7,
    name: "테스트 숙소",
    thumbnailUrl: "https://images.example.com/accommodation.jpg",
  },
  addressLabel: "KR Seoul Mapo 와우산로",
  checkIn: {
    dateLabel: "2026년 7월 10일 (금)",
    timeLabel: "오후 3:00",
  },
  checkOut: {
    dateLabel: "2026년 7월 12일 (일)",
    timeLabel: "오전 11:00",
  },
  host: {
    nickname: "호스트",
    displayName: "호스트님",
    avatarUrl: "https://images.example.com/host.jpg",
    avatarInitial: "호",
  },
  status: {
    label: "확정됨",
    tone: "success",
  },
  canReview: true,
  payment: {
    methodLabel: "가상계좌",
    amountLabel: "₩240,000",
    approvedAtLabel: "2026년 7월 1일 오후 2:00",
    statusLabel: "입금 대기",
    statusTone: "warning",
    virtualAccount: {
      bankName: "국민은행",
      accountNumber: "1234567890",
      customerName: "에어비앤비",
      dueDateLabel: "2026년 7월 2일 오후 11:59",
    },
  },
  mapEmbedUrl:
    "https://www.google.com/maps/embed/v1/place?key=maps-key&q=37.5%2C127",
};

const hostView: HostReservationDetailView = {
  reservationCode: "HOST-CODE-1",
  statusLabel: "확정됨",
  statusTone: "success",
  guest: {
    nickname: "게스트",
    avatarUrl: "https://images.example.com/guest.jpg",
    avatarInitial: "게",
  },
  guestStaySummaryLabel: "2게스트 • 2박 • ₩240,000",
  accommodation: {
    id: 7,
    name: "테스트 숙소",
    thumbnailUrl: "https://images.example.com/accommodation.jpg",
  },
  addressLabel: "KR Seoul Mapo 와우산로",
  guestCountLabel: "게스트 2명",
  checkInDateLabel: "2026년 7월 10일 (금)",
  checkOutDateLabel: "2026년 7월 12일 (일)",
  createdAtDateLabel: "2026년 7월 1일 (수)",
  payment: {
    nights: 2,
    pricePerNightLabel: "₩120,000",
    totalAmountLabel: "₩240,000",
  },
};

describe("ReservationDetailScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves loading, missing, and dismissible error terminals", () => {
    const { rerender } = render(
      <ReservationDetailScreen
        variant="guest"
        state={{ status: "loading" }}
        feedbackMessage={null}
        actions={guestActions}
      />,
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    rerender(
      <ReservationDetailScreen
        variant="host"
        state={{ status: "missing" }}
        actions={hostActions}
      />,
    );

    expect(screen.getByText("예약을 찾을 수 없습니다.")).toBeInTheDocument();

    rerender(
      <ReservationDetailScreen
        variant="host"
        state={{ status: "error", message: "존재하지 않는 예약입니다." }}
        actions={hostActions}
      />,
    );

    expect(
      screen.getByText("예약 정보를 불러오지 못했어요"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "존재하지 않는 예약입니다.",
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(hostActions.onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders guest loading and terminal states without inventing retry", () => {
    const { rerender } = render(
      <ReservationDetailScreen
        variant="guest"
        state={{ status: "loading" }}
        feedbackMessage={null}
        actions={guestActions}
      />,
    );

    const loadingStatus = screen.getByRole("status");
    expect(loadingStatus).toHaveAttribute("data-state-kind", "loading");
    expect(loadingStatus).toHaveAttribute("aria-live", "polite");
    expect(loadingStatus).toHaveTextContent("로딩 중...");
    expect(
      screen.getByTestId("guest-reservation-loading-skeletons"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "다시 시도" }),
    ).not.toBeInTheDocument();

    rerender(
      <ReservationDetailScreen
        variant="guest"
        state={{ status: "missing" }}
        feedbackMessage={null}
        actions={guestActions}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "예약을 찾을 수 없습니다.",
    );
    expect(
      screen.queryByRole("button", { name: "다시 시도" }),
    ).not.toBeInTheDocument();

    rerender(
      <ReservationDetailScreen
        variant="guest"
        state={{ status: "error", message: "존재하지 않는 예약입니다." }}
        feedbackMessage={null}
        actions={guestActions}
      />,
    );

    expect(
      screen.getByText("예약 정보를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "존재하지 않는 예약입니다.",
    );
    expect(
      screen.queryByRole("button", { name: "다시 시도" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "오류 닫기" }));
    expect(guestActions.onDismissError).toHaveBeenCalledTimes(1);
  });

  it("renders the guest detail and delegates every navigation action", () => {
    render(
      <ReservationDetailScreen
        variant="guest"
        state={{ status: "ready", view: guestView }}
        feedbackMessage="리뷰는 작성되었지만 이미지 업로드에 실패했습니다."
        actions={guestActions}
      />,
    );

    expect(screen.getByText("확정됨")).toBeInTheDocument();
    expect(screen.getByText("KR Seoul Mapo 와우산로")).toBeInTheDocument();
    expect(screen.getByText("게스트 2명")).toBeInTheDocument();
    expect(screen.getByText("CODE-123")).toBeInTheDocument();
    expect(screen.getByText("가상계좌 입금 정보")).toBeInTheDocument();
    expect(screen.getByText("국민은행")).toBeInTheDocument();
    expect(screen.getByText("1234567890")).toBeInTheDocument();
    expect(
      screen.getByText("위 가상계좌로 입금 기한 내에 입금해주세요."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "테스트 숙소" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "여행 일정" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "예약 세부정보" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "숙소 위치" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(
      expect.arrayContaining([
        "체크인",
        "체크아웃",
        "게스트",
        "예약 코드",
        "결제 방법",
        "결제 금액",
        "결제 일시",
        "은행",
        "계좌번호",
        "예금주",
        "입금 기한",
      ]),
    );

    fireEvent.click(screen.getByRole("button", { name: /돌아가기/ }));
    fireEvent.click(screen.getByRole("button", { name: "뒤로 가기" }));
    fireEvent.click(screen.getByRole("button", { name: "숙소로 이동하기" }));
    fireEvent.click(screen.getByRole("button", { name: "리뷰 작성하기" }));

    expect(guestActions.onBackToProfile).toHaveBeenCalledTimes(1);
    expect(guestActions.onBack).toHaveBeenCalledTimes(1);
    expect(guestActions.onOpenAccommodation).toHaveBeenCalledWith(7);
    expect(guestActions.onOpenReview).toHaveBeenCalledWith("reservation-123");

    const map = screen.getByTitle("숙소 위치");
    expect(map).toHaveAttribute("loading", "lazy");
    expect(map).toHaveAttribute("allowfullscreen");
    expect(map).toHaveAttribute(
      "referrerpolicy",
      "strict-origin-when-cross-origin",
    );
    expect(map).toHaveAttribute("src", guestView.mapEmbedUrl);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
    );
    fireEvent.click(screen.getByRole("button", { name: "오류 닫기" }));
    expect(guestActions.onDismissFeedback).toHaveBeenCalledTimes(1);
  });

  it("preserves guest optional branches and map fallback", () => {
    render(
      <ReservationDetailScreen
        variant="guest"
        state={{
          status: "ready",
          view: {
            ...guestView,
            accommodation: {
              ...guestView.accommodation,
              thumbnailUrl: null,
            },
            canReview: false,
            host: {
              ...guestView.host,
              avatarUrl: null,
            },
            mapEmbedUrl: null,
            payment: null,
          },
        }}
        feedbackMessage={null}
        actions={guestActions}
      />,
    );

    expect(screen.queryByText("리뷰 작성하기")).not.toBeInTheDocument();
    expect(screen.queryByText("결제 정보")).not.toBeInTheDocument();
    expect(screen.getByText("지도를 불러올 수 없습니다.")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "테스트 숙소 이미지 없음" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "호스트 프로필 이미지 없음",
      }),
    ).toHaveTextContent("호");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("replaces failed guest accommodation and host images in place", () => {
    render(
      <ReservationDetailScreen
        variant="guest"
        state={{ status: "ready", view: guestView }}
        feedbackMessage={null}
        actions={guestActions}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "테스트 숙소" }));
    fireEvent.error(screen.getByRole("img", { name: "호스트" }));

    expect(
      screen.getByRole("img", { name: "테스트 숙소 이미지 없음" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "호스트 프로필 이미지 없음",
      }),
    ).toBeVisible();
  });

  it("keeps the guest ledger responsive and interaction-token backed", () => {
    const css = readFileSync(
      `${__dirname}/GuestReservationDetailScreen.module.css`,
      "utf8",
    );

    expect(css).toContain(
      "grid-template-columns: minmax(0, 640px) minmax(0, 1fr);",
    );
    expect(css).toContain("min-height: var(--control-touch-target);");
    expect(css).toContain("box-shadow: var(--focus-ring-visible);");
    expect(css).toMatch(
      /\.map:focus-visible\s*\{[\s\S]*?outline:\s*3px solid var\(--color-focus-visible\);[\s\S]*?outline-offset:\s*-3px;/,
    );
    expect(css).toContain("@media (--viewport-mobile-tablet)");
    expect(css).toContain("@media (--viewport-tablet)");
    expect(css).toContain("@media (--viewport-phone)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition: none;");
  });

  it("renders the host detail and delegates back and accommodation actions", () => {
    render(
      <ReservationDetailScreen
        variant="host"
        state={{ status: "ready", view: hostView }}
        actions={hostActions}
      />,
    );

    expect(screen.getByText("확정됨")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "게스트님의 예약" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2게스트 • 2박 • ₩240,000")).toBeInTheDocument();
    expect(screen.getByText("테스트 숙소")).toBeInTheDocument();
    expect(screen.getByText("KR Seoul Mapo 와우산로")).toBeInTheDocument();
    expect(screen.getByText("2026년 7월 10일 (금)")).toBeInTheDocument();
    expect(screen.getByText("2026년 7월 12일 (일)")).toBeInTheDocument();
    expect(screen.getByText("2026년 7월 1일 (수)")).toBeInTheDocument();
    expect(screen.getByText("2박 × ₩120,000")).toBeInTheDocument();
    expect(screen.getByText("₩240,000")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "머무는 곳" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "체크인 정보" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "요금 세부 정보" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(
      expect.arrayContaining([
        "게스트",
        "체크인",
        "체크아웃",
        "예약일",
        "예약 코드",
        "숙박 요금",
        "총액 KRW",
      ]),
    );

    fireEvent.click(screen.getByRole("button", { name: "예약 목록으로" }));
    fireEvent.click(
      screen.getByRole("button", { name: "테스트 숙소 숙소로 이동하기" }),
    );

    expect(hostActions.onBack).toHaveBeenCalledTimes(1);
    expect(hostActions.onOpenAccommodation).toHaveBeenCalledWith(7);
  });

  it("renders host avatar and payment fallbacks without inventing content", () => {
    render(
      <ReservationDetailScreen
        variant="host"
        state={{
          status: "ready",
          view: {
            ...hostView,
            accommodation: {
              ...hostView.accommodation,
              thumbnailUrl: null,
            },
            guest: {
              ...hostView.guest,
              avatarUrl: null,
            },
            payment: null,
          },
        }}
        actions={hostActions}
      />,
    );

    expect(
      screen.getByRole("img", { name: "게스트 프로필 이미지 없음" }),
    ).toHaveTextContent("게");
    expect(
      screen.getByRole("img", { name: "테스트 숙소 숙소 이미지 없음" }),
    ).toBeVisible();
    expect(
      screen.getByText("표시할 결제 정보가 없습니다."),
    ).toBeInTheDocument();
  });

  it("replaces failed host-detail images and preserves responsive contracts", () => {
    render(
      <ReservationDetailScreen
        variant="host"
        state={{ status: "ready", view: hostView }}
        actions={hostActions}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "게스트" }));
    fireEvent.error(screen.getByRole("img", { name: "테스트 숙소" }));

    expect(
      screen.getByRole("img", { name: "게스트 프로필 이미지 없음" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "테스트 숙소 숙소 이미지 없음" }),
    ).toBeVisible();

    const css = readFileSync(
      `${__dirname}/HostReservationDetailScreen.module.css`,
      "utf8",
    );
    expect(css).toContain("min-height: var(--control-touch-target);");
    expect(css).toContain("box-shadow: var(--focus-ring-visible);");
    expect(css).toContain("@media (--viewport-tablet)");
    expect(css).toContain("@media (--viewport-phone)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
