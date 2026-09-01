import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../../test/renderApp";
import {
  ReservationConfirmScreen,
  type ReservationConfirmScreenProps,
} from "./ReservationConfirmScreen";

const createProps = (): ReservationConfirmScreenProps => ({
  canReleaseHold: true,
  errorMessage: null,
  isReleasing: false,
  onClearError: vi.fn(),
  onConfirmPayment: vi.fn(),
  onReleaseHold: vi.fn(),
  paymentStatus: "ready",
  state: {
    status: "ready",
    accommodation: {
      averageRating: 4.5,
      name: "테스트 숙소",
      nightlyPrice: 100_000,
      reviewCount: 3,
      thumbnailUrl: "https://cdn.example.com/stay.jpg",
    },
    checkout: {
      cancellationDeadlineLabel: "7월 9일",
      coupon: {
        discountAmount: 20_000,
        name: "여름 할인",
      },
      dateLabel: "2026년 7월 10일~2026년 7월 12일",
      guestLabel: "성인 3명, 유아 1명, 반려동물 1마리",
      nights: 2,
      payableAmount: 180_000,
      totalPrice: 200_000,
    },
  },
});

describe("ReservationConfirmScreen", () => {
  it("renders the preserved checkout summary from view props", () => {
    renderApp(<ReservationConfirmScreen {...createProps()} />);

    expect(
      screen.getByRole("heading", { name: "확인 및 결제" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "테스트 숙소" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/stay.jpg",
    );
    expect(screen.getByText("테스트 숙소")).toBeInTheDocument();
    expect(screen.getByText("4.50")).toBeInTheDocument();
    expect(screen.getByText("(후기 3개)")).toBeInTheDocument();
    expect(
      screen.getByText("7월 9일까지 예약을 취소하면 요금 전액이 환불됩니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("2026년 7월 10일~2026년 7월 12일"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("성인 3명, 유아 1명, 반려동물 1마리"),
    ).toBeInTheDocument();
    expect(screen.getByText("2박 x ₩100,000")).toBeInTheDocument();
    expect(screen.getByText("₩200,000")).toBeInTheDocument();
    expect(screen.getByText("여름 할인")).toBeInTheDocument();
    expect(screen.getByText("-₩20,000")).toBeInTheDocument();
    expect(screen.getByText("₩180,000")).toBeInTheDocument();
  });

  it("omits optional image, rating, cancellation copy, and coupon rows", () => {
    const props = createProps();
    if (props.state.status !== "ready") throw new Error("invalid fixture");

    renderApp(
      <ReservationConfirmScreen
        {...props}
        state={{
          ...props.state,
          accommodation: {
            ...props.state.accommodation,
            averageRating: 0,
            reviewCount: 0,
            thumbnailUrl: null,
          },
          checkout: {
            ...props.state.checkout,
            cancellationDeadlineLabel: null,
            coupon: null,
          },
        }}
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText(/후기/)).not.toBeInTheDocument();
    expect(screen.queryByText(/까지 예약을 취소하면/)).not.toBeInTheDocument();
    expect(screen.queryByText("쿠폰 할인")).not.toBeInTheDocument();
  });

  it("renders loading and error terminals without a payment action", () => {
    const props = createProps();
    const { rerender } = renderApp(
      <ReservationConfirmScreen {...props} state={{ status: "loading" }} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("로딩 중...");
    expect(
      screen.queryByRole("button", { name: "확인 및 결제" }),
    ).not.toBeInTheDocument();

    rerender(
      <ReservationConfirmScreen
        {...props}
        state={{
          status: "error",
          message: "숙소 정보를 불러올 수 없습니다.",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "숙소 정보를 불러올 수 없습니다.",
    );
    expect(
      screen.queryByRole("button", { name: "확인 및 결제" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["loading", "결제 시스템 로딩 중..."],
    ["processing", "결제 진행 중..."],
  ] as const)("disables payment while %s", (paymentStatus, buttonName) => {
    renderApp(
      <ReservationConfirmScreen
        {...createProps()}
        paymentStatus={paymentStatus}
      />,
    );

    expect(screen.getByRole("button", { name: buttonName })).toBeDisabled();
  });

  it("delegates a ready payment click exactly once", async () => {
    const props = createProps();
    renderApp(<ReservationConfirmScreen {...props} />);

    const paymentButton = screen.getByRole("button", { name: "확인 및 결제" });
    expect(paymentButton).toBeEnabled();
    await userEvent.click(paymentButton);

    expect(props.onConfirmPayment).toHaveBeenCalledTimes(1);
  });

  it("offers an explicit hold release without coupling it to payment", async () => {
    const props = createProps();
    renderApp(<ReservationConfirmScreen {...props} />);

    await userEvent.click(
      screen.getByRole("button", { name: "예약을 취소하고 객실 해제" }),
    );

    expect(props.onReleaseHold).toHaveBeenCalledOnce();
    expect(props.onConfirmPayment).not.toHaveBeenCalled();
  });

  it("presents payment errors and delegates dismissal", async () => {
    const props = createProps();
    renderApp(
      <ReservationConfirmScreen
        {...props}
        errorMessage="결제 정보를 다시 확인해주세요."
      />,
    );

    expect(
      screen.getByText("결제 정보를 다시 확인해주세요."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "오류 닫기" }));
    expect(props.onClearError).toHaveBeenCalledTimes(1);
  });
});
