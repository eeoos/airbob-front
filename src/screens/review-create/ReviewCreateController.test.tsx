import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../../test/renderApp";
import type { SessionSubject } from "../../platform/session/sessionScope";
import { ReviewCreateController } from "./ReviewCreateController";

const mockUseReviewableReservationReadQuery = vi.fn();
const mockCreateWorkflow = vi.fn();
const mockSubmit = vi.fn();
const mockDispose = vi.fn();

vi.mock("../../features/reservations/public", () => ({
  useReviewableReservationReadQuery: (...args: unknown[]) =>
    mockUseReviewableReservationReadQuery(...args),
}));

vi.mock("../../features/reviews/public", () => ({
  reviewApi: {},
}));

vi.mock("../../workflows/review-submission", () => ({
  createReviewSubmissionWorkflow: (...args: unknown[]) =>
    mockCreateWorkflow(...args),
}));

const reservation = {
  reservationUid: "reservation-123",
  canWriteReview: true,
  checkInDateTime: "2026-07-10T15:00:00",
  checkOutDateTime: "2026-07-12T11:00:00",
  accommodation: {
    id: 7,
    name: "테스트 숙소",
    thumbnailUrl: "/room.jpg",
  },
  address: {
    country: "대한민국",
    state: null,
    city: "서울",
    district: "마포구",
    street: "와우산로",
    detail: null,
  },
};

const session = {
  captureAuthenticatedSession: vi.fn(() => ({
    subject: "subject:member_1" as SessionSubject,
    epoch: 3,
  })),
  isCurrentSession: vi.fn(() => true),
};
const authenticatedScope = {
  subject: "subject:member_1" as SessionSubject,
  epoch: 3,
};

const renderController = (
  overrides: Partial<React.ComponentProps<typeof ReviewCreateController>> = {},
) => {
  const props: React.ComponentProps<typeof ReviewCreateController> = {
    onBack: vi.fn(),
    onComplete: vi.fn(),
    publication: { publishReviewCreated: vi.fn() },
    reservationUid: "reservation-123",
    resolveImageUrl: (path) => `https://cdn.example.com${path ?? ""}`,
    routeLease: { isCurrent: () => true },
    scope: authenticatedScope,
    session,
    ...overrides,
  };

  renderApp(<ReviewCreateController {...props} />);
  return props;
};

describe("ReviewCreateController", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:review-image");
    URL.revokeObjectURL = vi.fn();
    session.captureAuthenticatedSession.mockReturnValue({
      subject: "subject:member_1" as SessionSubject,
      epoch: 3,
    });
    session.isCurrentSession.mockReturnValue(true);
    mockUseReviewableReservationReadQuery.mockReset();
    mockUseReviewableReservationReadQuery.mockReturnValue({
      data: reservation,
      error: null,
      isError: false,
      isLoading: false,
    });
    mockSubmit.mockReset();
    mockDispose.mockReset();
    mockCreateWorkflow.mockReset();
    mockCreateWorkflow.mockReturnValue({
      dispose: mockDispose,
      submit: mockSubmit,
    });
  });

  it("reads the reviewable reservation through the current authenticated scope", () => {
    renderController();

    expect(mockUseReviewableReservationReadQuery).toHaveBeenLastCalledWith({
      reservationUid: "reservation-123",
      scope: {
        subject: "subject:member_1",
        epoch: 3,
      },
    });
    expect(screen.getByText("테스트 숙소")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "테스트 숙소" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/room.jpg",
    );
  });

  it("keeps the committed submission workflow live through StrictMode replay", async () => {
    const props: React.ComponentProps<typeof ReviewCreateController> = {
      onBack: vi.fn(),
      onComplete: vi.fn(),
      publication: { publishReviewCreated: vi.fn() },
      reservationUid: "reservation-123",
      resolveImageUrl: (path) => path ?? "",
      routeLease: { isCurrent: () => true },
      scope: authenticatedScope,
      session,
    };
    mockSubmit.mockResolvedValue({ status: "invalid" });

    renderApp(
      <StrictMode>
        <ReviewCreateController {...props} />
      </StrictMode>,
    );
    await act(async () => Promise.resolve());
    expect(mockDispose).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("리뷰 내용"), "좋은 숙소예요");
    await userEvent.click(
      screen.getByRole("button", { name: "리뷰 작성하기" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "리뷰 내용을 입력해주세요.",
    );
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows an authorization query failure as a terminal without redirect or mutation", () => {
    mockUseReviewableReservationReadQuery.mockReturnValue({
      data: undefined,
      error: { code: "V003" },
      isError: true,
      isLoading: false,
    });
    const { onBack, onComplete } = renderController();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "리뷰를 작성할 권한이 없습니다.",
    );
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("rejects an image larger than 10MB without creating a preview", () => {
    const oversizedImage = new File(["image"], "large.png", {
      type: "image/png",
    });
    Object.defineProperty(oversizedImage, "size", {
      value: 10 * 1024 * 1024 + 1,
    });
    renderController();

    fireEvent.change(screen.getByLabelText("사진 선택"), {
      target: { files: [oversizedImage] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "large.png 파일 크기는 10MB를 초과할 수 없습니다.",
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByAltText("미리보기 1")).not.toBeInTheDocument();
  });

  it("rejects an unsupported image MIME type without creating a preview", () => {
    const unsupportedFile = new File(["text"], "note.txt", {
      type: "text/plain",
    });
    renderController();

    fireEvent.change(screen.getByLabelText("사진 선택"), {
      target: { files: [unsupportedFile] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "note.txt은(는) 지원하지 않는 이미지 형식입니다.",
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByAltText("미리보기 1")).not.toBeInTheDocument();
  });

  it("keeps valid images from a mixed selection and submits only those files", async () => {
    const validImage = new File(["image"], "stay.png", {
      type: "image/png",
    });
    const unsupportedFile = new File(["text"], "note.txt", {
      type: "text/plain",
    });
    mockSubmit.mockResolvedValue({ status: "invalid" });
    renderController();

    fireEvent.change(screen.getByLabelText("사진 선택"), {
      target: { files: [validImage, unsupportedFile] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "note.txt은(는) 지원하지 않는 이미지 형식입니다.",
    );
    expect(screen.getByAltText("미리보기 1")).toHaveAttribute(
      "src",
      "blob:review-image",
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    await userEvent.type(screen.getByLabelText("리뷰 내용"), "좋은 숙소예요");
    await userEvent.click(
      screen.getByRole("button", { name: "리뷰 작성하기" }),
    );

    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ images: [validImage] }),
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "리뷰 내용을 입력해주세요.",
    );
  });

  it("retains the form and allows retry after a definitive create failure", async () => {
    mockSubmit.mockResolvedValue({
      status: "definitive-failure",
      error: { kind: "validation" },
    });
    const { onComplete } = renderController();

    await userEvent.type(screen.getByLabelText("리뷰 내용"), "좋은 숙소예요");
    await userEvent.click(
      screen.getByRole("button", { name: "리뷰 작성하기" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "리뷰 내용을 확인해주세요.",
    );
    expect(screen.getByLabelText("리뷰 내용")).toHaveValue("좋은 숙소예요");
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "리뷰 작성하기" })).toBeEnabled();
  });

  it("locks repeat submission when the create outcome is ambiguous", async () => {
    mockSubmit.mockResolvedValue({
      status: "ambiguous",
      error: { kind: "network" },
    });
    const { onBack, onComplete } = renderController();

    await userEvent.type(screen.getByLabelText("리뷰 내용"), "좋은 숙소예요");
    await userEvent.click(
      screen.getByRole("button", { name: "리뷰 작성하기" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "예약 상세에서 리뷰 작성 가능 여부를 확인해주세요.",
    );
    const lockedSubmit = screen.getByRole("button", {
      name: "예약 상세에서 결과 확인",
    });
    expect(lockedSubmit).toBeDisabled();
    expect(screen.getByRole("button", { name: "취소" })).toBeEnabled();

    lockedSubmit.click();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("locks a replacement route generation when an earlier create may have committed", async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise((promiseResolve) => {
      resolve = promiseResolve;
    });
    mockSubmit.mockReturnValue(pending);
    mockCreateWorkflow.mockImplementation(() => ({
      dispose: mockDispose,
      submit: mockSubmit,
    }));
    const props: React.ComponentProps<typeof ReviewCreateController> = {
      onBack: vi.fn(),
      onComplete: vi.fn(),
      publication: { publishReviewCreated: vi.fn() },
      reservationUid: "reservation-123",
      resolveImageUrl: (path) => path ?? "",
      routeLease: { isCurrent: () => true },
      scope: authenticatedScope,
      session,
    };
    const view = renderApp(<ReviewCreateController {...props} />);

    await userEvent.type(screen.getByLabelText("리뷰 내용"), "좋은 숙소예요");
    await userEvent.click(
      screen.getByRole("button", { name: "리뷰 작성하기" }),
    );
    expect(mockSubmit).toHaveBeenCalledTimes(1);

    view.rerender(
      <ReviewCreateController
        {...props}
        routeLease={{ isCurrent: () => true }}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "예약 상세에서 리뷰 작성 가능 여부를 확인해주세요.",
    );
    expect(
      screen.getByRole("button", { name: "예약 상세에서 결과 확인" }),
    ).toBeDisabled();
    expect(mockSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ status: "stale" });
      await pending;
    });
  });

  it("publishes one completion for same-tick duplicate submit attempts", async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise((promiseResolve) => {
      resolve = promiseResolve;
    });
    mockSubmit.mockReturnValue(pending);
    const { onComplete } = renderController();

    await userEvent.type(screen.getByLabelText("리뷰 내용"), "좋은 숙소예요");
    const submit = screen.getByRole("button", { name: "리뷰 작성하기" });
    act(() => {
      submit.click();
      submit.click();
    });

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({
        status: "success",
        reservationUid: "reservation-123",
        reviewId: 9,
        cachePublication: "succeeded",
      });
      await pending;
    });

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith("reservation-123", "success"),
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("maps upload partial success to the typed navigation result", async () => {
    mockSubmit.mockResolvedValue({
      status: "created_without_images",
      reason: "upload_failed",
      reservationUid: "reservation-123",
      reviewId: 9,
      cachePublication: "succeeded",
    });
    const { onComplete } = renderController();

    await userEvent.type(screen.getByLabelText("리뷰 내용"), "좋은 숙소예요");
    await userEvent.click(
      screen.getByRole("button", { name: "리뷰 작성하기" }),
    );

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith(
        "reservation-123",
        "image-upload-failed",
      ),
    );
  });

  it("never navigates after a review was created for a stale continuation", async () => {
    mockSubmit.mockResolvedValue({
      status: "created_stale",
      reservationUid: "reservation-123",
      reviewId: 9,
      cachePublication: "skipped",
    });
    const { onComplete } = renderController();

    await userEvent.type(screen.getByLabelText("리뷰 내용"), "좋은 숙소예요");
    await userEvent.click(
      screen.getByRole("button", { name: "리뷰 작성하기" }),
    );

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
