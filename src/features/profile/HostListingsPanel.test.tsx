import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  HostListingsPanel,
  type HostListingsPanelProps,
} from "./HostListingsPanel";
import styles from "./HostListingsPanel.module.css";

const listing = {
  id: 7,
  imageAlt: "바다 숙소",
  locationLabel: "부산, 해운대구",
  managementLabel: "바다 숙소 숙소 관리 열기",
  name: "바다 숙소",
  statusLabel: "공개",
  thumbnailUrl: null,
} as const;

const createProps = (
  overrides: Partial<HostListingsPanelProps> = {},
): HostListingsPanelProps => ({
  errorMessage: null,
  loadMoreRef: vi.fn(),
  onDismissError: vi.fn(),
  onOpenListingActions: vi.fn(),
  onStatusChange: vi.fn(),
  state: {
    status: "ready",
    listings: [],
    hasNext: false,
    isLoadingMore: false,
  },
  statusType: "PUBLISHED",
  ...overrides,
});

describe("HostListingsPanel", () => {
  it("renders only the shared loading state while loading", () => {
    render(
      <HostListingsPanel
        {...createProps({ state: { status: "loading" } })}
      />,
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
    expect(screen.queryByText("숙소 관리")).not.toBeInTheDocument();
  });

  it("preserves the empty state, filters, and dismissible error toast", async () => {
    const onDismissError = vi.fn();
    const onStatusChange = vi.fn();

    render(
      <HostListingsPanel
        {...createProps({
          errorMessage: "숙소를 불러오지 못했습니다.",
          onDismissError,
          onStatusChange,
        })}
      />,
    );

    expect(screen.getByText("숙소 관리")).toBeInTheDocument();
    expect(screen.getByText("아직 숙소가 없습니다.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "작성 중" }));
    expect(onStatusChange).toHaveBeenCalledWith("DRAFT");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "숙소를 불러오지 못했습니다.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "오류 닫기" }),
    );
    expect(onDismissError).toHaveBeenCalledTimes(1);
  });

  it("renders semantic listing cards and delegates selection by id", () => {
    const onOpenListingActions = vi.fn();

    render(
      <HostListingsPanel
        {...createProps({
          onOpenListingActions,
          state: {
            status: "ready",
            listings: [listing],
            hasNext: false,
            isLoadingMore: false,
          },
        })}
      />,
    );

    const card = screen.getByRole("button", {
      name: "바다 숙소 숙소 관리 열기",
    });
    const article = screen.getByRole("article");

    expect(article).toHaveClass(styles.accommodationCard ?? "");
    expect(card).not.toContainElement(screen.getByText("바다 숙소"));
    expect(screen.getByText("🏠")).toBeInTheDocument();
    expect(screen.getByText("부산, 해운대구")).toBeInTheDocument();
    expect(within(article).getByText("공개")).toBeInTheDocument();

    fireEvent.click(card);

    expect(onOpenListingActions).toHaveBeenCalledWith(7);
  });

  it("attaches the injected load-more ref and preserves loading copy", () => {
    const loadMoreRef = vi.fn();

    render(
      <HostListingsPanel
        {...createProps({
          loadMoreRef,
          state: {
            status: "ready",
            listings: [listing],
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
