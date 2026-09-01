import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverlayProvider } from "../../../../app/overlays/OverlayProvider";
import type { Review } from "../../model";
import { toReviewViewModels } from "../../lib/reviewViewModel";
import { ReviewModal } from "./ReviewModal";

vi.mock("../../../../platform/assets/imageUrl", () => ({
  resolveImageUrl: (url: string) => url,
}));

const reviews: Review[] = [
  {
    id: 1,
    rating: 5,
    content: "가장 좋은 후기",
    reviewedAt: "2026-07-03T10:00:00Z",
    reviewer: {
      id: 10,
      nickname: "민수",
      thumbnailImageUrl: "/minsu.jpg",
    },
    images: [{ id: 20, imageUrl: "/stay.jpg" }],
  },
  {
    id: 2,
    rating: 1,
    content: "낮은 평점 후기",
    reviewedAt: "2026-07-01T10:00:00Z",
    reviewer: {
      id: 11,
      nickname: "지영",
      thumbnailImageUrl: null,
    },
    images: [],
  },
];

let activeIntersectionObserver:
  | {
      callback: IntersectionObserverCallback;
      observer: IntersectionObserver;
    }
  | undefined;

const originalIntersectionObserver = globalThis.IntersectionObserver;

const installIntersectionObserver = () => {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: vi.fn(function IntersectionObserverMock(
      callback: IntersectionObserverCallback,
    ) {
      const observer = {
        disconnect: vi.fn(),
        observe: vi.fn(),
        root: null,
        rootMargin: "0px",
        takeRecords: vi.fn(() => []),
        thresholds: [0],
        unobserve: vi.fn(),
      } as IntersectionObserver;
      activeIntersectionObserver = { callback, observer };
      return observer;
    }),
    writable: true,
  });
};

const emitIntersection = (isIntersecting: boolean) => {
  if (!activeIntersectionObserver) {
    throw new Error("IntersectionObserver was not installed.");
  }

  activeIntersectionObserver.callback(
    [{ isIntersecting } as IntersectionObserverEntry],
    activeIntersectionObserver.observer,
  );
};

const renderReviewModal = (
  overrides: Partial<React.ComponentProps<typeof ReviewModal>> = {},
) => {
  const props: React.ComponentProps<typeof ReviewModal> = {
    averageRating: 4.25,
    errorMessage: null,
    hasNext: false,
    isFetching: false,
    isOpen: true,
    isRetrying: false,
    loadMoreErrorMessage: null,
    onClose: vi.fn(),
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
    onRetryLoadMore: vi.fn(),
    reviews: toReviewViewModels(reviews),
    status: "ready",
    totalCount: 2,
    ...overrides,
  };

  const view = render(<ReviewModal {...props} />);

  return { props, ...view };
};

const reviewContents = () =>
  screen.getAllByText(/후기$/).map((element) => element.textContent);

describe("ReviewModal", () => {
  beforeEach(() => {
    activeIntersectionObserver = undefined;
    installIntersectionObserver();
  });

  afterAll(() => {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: originalIntersectionObserver,
      writable: true,
    });
  });

  it("renders a semantic record and discloses the loaded sorting scope", () => {
    renderReviewModal();

    expect(
      screen.getByRole("dialog", { name: "후기 2개" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "평점 4.25 · 후기 2개" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("현재 불러온 후기 2개 안에서 정렬합니다."),
    ).toBeVisible();
    expect(screen.getByRole("img", { name: "5점 만점에 5점" })).toBeVisible();
    expect(screen.getByText("가장 좋은 후기")).toBeInTheDocument();
    expect(screen.getByText("낮은 평점 후기")).toBeInTheDocument();

    fireEvent.error(screen.getByAltText("리뷰 이미지"));
    expect(screen.getByRole("img", { name: "후기 이미지 없음" })).toBeVisible();
  });

  it("closes from explicit close control, Escape, and backdrop", async () => {
    const { props } = renderReviewModal();

    await userEvent.click(
      screen.getByRole("button", { name: "후기 모달 닫기" }),
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("presentation"));

    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it("sorts reviews from the dropdown", async () => {
    renderReviewModal();

    expect(reviewContents()).toEqual(["가장 좋은 후기", "낮은 평점 후기"]);

    await userEvent.click(screen.getByRole("button", { name: "최신순" }));
    await userEvent.click(screen.getByRole("button", { name: "낮은 평점순" }));

    const dialog = screen.getByRole("dialog", { name: "후기 2개" });
    expect(
      within(dialog)
        .getAllByText(/후기$/)
        .map((element) => element.textContent),
    ).toEqual(["낮은 평점 후기", "가장 좋은 후기"]);
  });

  it("closes the sort popover before its dialog and restores trigger focus", async () => {
    const onClose = vi.fn();

    render(
      <OverlayProvider>
        <ReviewModal
          averageRating={4.25}
          errorMessage={null}
          hasNext={false}
          isFetching={false}
          isOpen
          isRetrying={false}
          loadMoreErrorMessage={null}
          onClose={onClose}
          onLoadMore={vi.fn()}
          onRetry={vi.fn()}
          onRetryLoadMore={vi.fn()}
          reviews={toReviewViewModels(reviews)}
          status="ready"
          totalCount={2}
        />
      </OverlayProvider>,
    );

    const sortTrigger = screen.getByRole("button", { name: "최신순" });
    await userEvent.click(sortTrigger);
    screen.getByRole("button", { name: "낮은 평점순" }).focus();

    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "낮은 평점순" }),
    ).not.toBeInTheDocument();
    await act(async () => undefined);
    expect(sortTrigger).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while closed", () => {
    const { container } = renderReviewModal({ isOpen: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("does not load another page just because the modal opened", () => {
    const { props } = renderReviewModal({ hasNext: true });

    expect(props.onLoadMore).not.toHaveBeenCalled();
  });

  it("loads one page for one sentinel visibility event", () => {
    const { props } = renderReviewModal({ hasNext: true });

    act(() => emitIntersection(true));

    expect(props.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("renders initial loading, empty, and retryable states", async () => {
    const onRetry = vi.fn();
    const { rerender } = renderReviewModal({ status: "loading" });

    expect(
      screen.getByRole("status", { name: "후기 불러오는 중" }),
    ).toBeVisible();

    rerender(
      <ReviewModal
        {...renderProps({ reviews: [], status: "empty", totalCount: 0 })}
      />,
    );
    expect(screen.getByText("아직 등록된 여행 기록이 없어요")).toBeVisible();

    rerender(
      <ReviewModal
        {...renderProps({
          errorMessage: "네트워크 연결을 확인해 주세요.",
          onRetry,
          reviews: [],
          status: "error",
        })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed next page inline and exposes one explicit retry", async () => {
    const onRetryLoadMore = vi.fn();
    renderReviewModal({
      hasNext: true,
      loadMoreErrorMessage: "후기를 더 불러오지 못했습니다.",
      onRetryLoadMore,
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "후기를 더 불러오지 못했습니다.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "이어서 다시 불러오기" }),
    );
    expect(onRetryLoadMore).toHaveBeenCalledTimes(1);
  });
});

const renderProps = (
  overrides: Partial<React.ComponentProps<typeof ReviewModal>> = {},
): React.ComponentProps<typeof ReviewModal> => ({
  averageRating: 4.25,
  errorMessage: null,
  hasNext: false,
  isFetching: false,
  isOpen: true,
  isRetrying: false,
  loadMoreErrorMessage: null,
  onClose: vi.fn(),
  onLoadMore: vi.fn(),
  onRetry: vi.fn(),
  onRetryLoadMore: vi.fn(),
  reviews: toReviewViewModels(reviews),
  status: "ready",
  totalCount: 2,
  ...overrides,
});
