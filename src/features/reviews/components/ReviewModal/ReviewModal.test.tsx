import { act, render, screen, within } from "@testing-library/react";
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
    images: [],
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
  overrides: Partial<React.ComponentProps<typeof ReviewModal>> = {}
) => {
  const props: React.ComponentProps<typeof ReviewModal> = {
    averageRating: 4.25,
    hasNext: false,
    isFetching: false,
    isOpen: true,
    onClose: vi.fn(),
    onLoadMore: vi.fn(),
    reviews: toReviewViewModels(reviews),
    totalCount: 2,
    ...overrides,
  };

  const view = render(<ReviewModal {...props} />);

  return { props, ...view };
};

const reviewContents = () =>
  screen
    .getAllByText(/후기$/)
    .map((element) => element.textContent);

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

  it("renders as a Dialog with review summary content", () => {
    renderReviewModal();

    expect(screen.getByRole("dialog", { name: "후기 2개" })).toBeInTheDocument();
    expect(screen.getByText("★ 4.25")).toBeInTheDocument();
    expect(screen.getByText("후기 2개")).toBeInTheDocument();
    expect(screen.getByText("가장 좋은 후기")).toBeInTheDocument();
    expect(screen.getByText("낮은 평점 후기")).toBeInTheDocument();
  });

  it("closes from explicit close control, Escape, and backdrop", async () => {
    const { props } = renderReviewModal();

    await userEvent.click(screen.getByRole("button", { name: "후기 모달 닫기" }));
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
        .map((element) => element.textContent)
    ).toEqual(["낮은 평점 후기", "가장 좋은 후기"]);
  });

  it("closes the sort popover before its dialog and restores trigger focus", async () => {
    const onClose = vi.fn();

    render(
      <OverlayProvider>
        <ReviewModal
          averageRating={4.25}
          hasNext={false}
          isFetching={false}
          isOpen
          onClose={onClose}
          onLoadMore={vi.fn()}
          reviews={toReviewViewModels(reviews)}
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
});
