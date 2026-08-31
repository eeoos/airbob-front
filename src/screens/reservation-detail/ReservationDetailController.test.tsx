import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  GuestReservationDetail,
  HostReservationDetail,
} from "../../features/reservations/model/reservationRead";
import type { ReservationReadApiPort } from "../../features/reservations/ports/reservationReadApiPort";
import { AppError } from "../../platform/http/errors";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import { ReservationDetailController } from "./ReservationDetailController";

const scope: AuthenticatedSessionScope = {
  subject: "subject:profile-test" as SessionSubject,
  epoch: 3,
};

const payment = {
  approvedAt: null,
  balanceAmount: null,
  cancels: [],
  method: null,
  orderId: "order-1",
  paymentKey: null,
  requestedAt: "2026-07-01T00:00:00",
  status: "DONE" as const,
  totalAmount: 240000,
  virtualAccount: null,
};

const guestReservation = (
  reservationUid = "reservation-1",
): GuestReservationDetail => ({
  audience: "guest",
  accommodation: {
    id: 7,
    name: "테스트 숙소",
    thumbnailUrl: "/rooms/7.jpg",
  },
  address: {
    city: "Seoul",
    country: "KR",
    detail: null,
    district: "Mapo",
    postalCode: "04000",
    state: null,
    street: "와우산로",
  },
  canWriteReview: false,
  checkInDateTime: "2026-07-10T15:00:00",
  checkInTime: "15:00",
  checkOutDateTime: "2026-07-12T11:00:00",
  checkOutTime: "11:00",
  coordinate: { latitude: 37.5, longitude: 127 },
  createdAt: "2026-07-01T00:00:00",
  guestCount: 2,
  host: { id: 2, nickname: "호스트", thumbnailImageUrl: null },
  payment,
  reservationCode: "CODE-1",
  reservationUid,
  status: "CONFIRMED",
});

const hostReservation = (
  reservationUid = "host-reservation-1",
): HostReservationDetail => ({
  audience: "host",
  accommodation: {
    id: 8,
    name: "호스트 숙소",
    thumbnailUrl: null,
  },
  address: {
    city: "Busan",
    country: "KR",
    detail: null,
    district: "Haeundae",
    postalCode: "48000",
    state: null,
    street: "해운대로",
  },
  checkInDateTime: "2026-07-10T15:00:00",
  checkOutDateTime: "2026-07-12T11:00:00",
  createdAt: "2026-07-01T00:00:00",
  guest: { id: 3, nickname: "게스트", thumbnailImageUrl: null },
  guestCount: 2,
  payment,
  reservationCode: "HOST-CODE-1",
  reservationUid,
  status: "CONFIRMED",
});

const createApi = () => {
  const getDetail = jest.fn();
  const getList = jest.fn();

  return {
    api: { getDetail, getList } as unknown as ReservationReadApiPort,
    getDetail,
  };
};

const renderController = (element: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  );
};

describe("ReservationDetailController", () => {
  it("maps the guest resource, map integration, and one-shot feedback", async () => {
    const { api, getDetail } = createApi();
    getDetail.mockResolvedValue(guestReservation());
    const navigation = {
      back: jest.fn(),
      backToProfile: jest.fn(),
      openAccommodation: jest.fn(),
      openReview: jest.fn(),
    };

    renderController(
      <ReservationDetailController
        variant="guest"
        api={api}
        buildMapEmbedUrl={({ latitude, longitude }) =>
          `map:${latitude},${longitude}`
        }
        feedbackMessage="리뷰 이미지 업로드에 실패했습니다."
        navigation={navigation}
        reservationUid="reservation-1"
        resolveImageUrl={(path) => `https://assets.test${path}`}
        scope={scope}
      />,
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
    expect(await screen.findByText("CODE-1")).toBeInTheDocument();
    expect(screen.getByTitle("숙소 위치")).toHaveAttribute(
      "src",
      "map:37.5,127",
    );
    expect(screen.getByAltText("테스트 숙소")).toHaveAttribute(
      "src",
      "https://assets.test/rooms/7.jpg",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "리뷰 이미지 업로드에 실패했습니다.",
    );

    fireEvent.click(screen.getByRole("button", { name: "오류 닫기" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(getDetail).toHaveBeenCalledWith(
      "guest",
      "reservation-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("keeps the error terminal after dismissing its toast and clears it for a new uid", async () => {
    const { api, getDetail } = createApi();
    getDetail
      .mockRejectedValueOnce(
        new AppError({
          kind: "http",
          code: "R008",
          message: "denied",
          status: 403,
        }),
      )
      .mockResolvedValueOnce(guestReservation("reservation-2"));
    const navigation = {
      back: jest.fn(),
      backToProfile: jest.fn(),
      openAccommodation: jest.fn(),
      openReview: jest.fn(),
    };
    const view = renderController(
      <ReservationDetailController
        variant="guest"
        api={api}
        buildMapEmbedUrl={() => null}
        feedbackMessage={null}
        navigation={navigation}
        reservationUid="reservation-1"
        resolveImageUrl={() => ""}
        scope={scope}
      />,
    );

    expect(
      await screen.findByText("예약 정보를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "해당 예약에 대한 접근 권한이 없습니다.",
    );
    fireEvent.click(screen.getByRole("button", { name: "오류 닫기" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByText("예약 정보를 불러오지 못했습니다."),
    ).toBeInTheDocument();

    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ReservationDetailController
          variant="guest"
          api={api}
          buildMapEmbedUrl={() => null}
          feedbackMessage={null}
          navigation={navigation}
          reservationUid="reservation-2"
          resolveImageUrl={() => ""}
          scope={scope}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("CODE-1")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("maps host detail without guest-only controls", async () => {
    const { api, getDetail } = createApi();
    getDetail.mockResolvedValue(hostReservation());
    const navigation = {
      back: jest.fn(),
      openAccommodation: jest.fn(),
    };

    renderController(
      <ReservationDetailController
        variant="host"
        api={api}
        navigation={navigation}
        reservationUid="host-reservation-1"
        resolveImageUrl={() => ""}
        scope={scope}
      />,
    );

    expect(await screen.findByText("HOST-CODE-1")).toBeInTheDocument();
    expect(screen.getByText("2게스트 • 2박 • ₩240,000")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "리뷰 작성하기" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(getDetail).toHaveBeenCalledWith(
        "host",
        "host-reservation-1",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });
});
