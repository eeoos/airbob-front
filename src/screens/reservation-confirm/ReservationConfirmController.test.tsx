import { fireEvent, screen, waitFor } from "@testing-library/react";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import { renderApp } from "../../test/renderApp";
import type {
  CheckoutData,
  PaymentGatewayPort,
} from "../../workflows/booking-payment/checkout";
import { ReservationConfirmController } from "./ReservationConfirmController";

const mockUseAccommodationDetailReadQuery = vi.fn();

vi.mock("../../features/accommodations/detail/public", () => ({
  useAccommodationDetailReadQuery: (...args: unknown[]) =>
    mockUseAccommodationDetailReadQuery(...args),
}));

const scope: AuthenticatedSessionScope = {
  epoch: 7,
  subject: "subject:reservation_confirm" as SessionSubject,
};

const checkout: CheckoutData = {
  operationId: "operation-1" as CheckoutData["operationId"],
  accommodationId: 42,
  reservationUid: "reservation-1",
  orderName: "테스트 숙소 예약",
  amount: 120_000,
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  adultOccupancy: 2,
  childOccupancy: 0,
  infantOccupancy: 0,
  petOccupancy: 0,
  couponName: null,
  couponDiscount: null,
};

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe("ReservationConfirmController", () => {
  beforeEach(() => {
    mockUseAccommodationDetailReadQuery.mockReturnValue({
      data: {
        id: 42,
        name: "테스트 숙소",
        basePrice: 60_000,
        images: [],
        reviewSummary: { averageRating: 4.5, totalCount: 3 },
      },
      isError: false,
      isLoading: false,
    });
  });

  it("keeps an accepted gateway request locked when only the session facade identity changes", async () => {
    const pendingRequest = deferred<void>();
    const gateway: PaymentGatewayPort = {
      prepare: vi.fn().mockResolvedValue(undefined),
      requestPayment: vi.fn().mockReturnValue(pendingRequest.promise),
    };
    const routeLease = { isCurrent: () => true };
    const sessionMethods = {
      captureAuthenticatedSession: () => scope,
      isCurrentSession: (candidate: AuthenticatedSessionScope) =>
        candidate.subject === scope.subject && candidate.epoch === scope.epoch,
    };
    const controller = (session = sessionMethods) => (
      <ReservationConfirmController
        checkout={checkout}
        customer={{ email: "guest@example.com", name: "게스트" }}
        failUrl="https://airbob.test/reservations/reservation-1/fail"
        gateway={gateway}
        resolveImageUrl={(path) => path ?? ""}
        routeLease={routeLease}
        scope={scope}
        session={session}
        successUrl="https://airbob.test/reservations/reservation-1/success"
      />
    );
    const view = renderApp(controller());

    const paymentButton = await screen.findByRole("button", {
      name: "확인 및 결제",
    });
    await waitFor(() => expect(paymentButton).toBeEnabled());
    fireEvent.click(paymentButton);
    await waitFor(() =>
      expect(gateway.requestPayment).toHaveBeenCalledTimes(1),
    );
    expect(
      screen.getByRole("button", { name: "결제 진행 중..." }),
    ).toBeDisabled();

    view.rerender(controller({ ...sessionMethods }));
    expect(gateway.prepare).toHaveBeenCalledTimes(1);
    expect(gateway.requestPayment).toHaveBeenCalledTimes(1);

    pendingRequest.resolve();
    await Promise.resolve();
    expect(
      screen.getByRole("button", { name: "결제 진행 중..." }),
    ).toBeDisabled();
    expect(gateway.requestPayment).toHaveBeenCalledTimes(1);
  });
});
