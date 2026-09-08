import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mocked } from "vitest";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../../platform/session/sessionScope";
import { testSessionRuntimeLeaseId } from "../../../../test/sessionFixtures";
import type { WishlistCollection } from "../../model";
import { useWishlistListsReadQuery } from "../../queries";
import { WISHLIST_REFRESH_WARNING_MESSAGE } from "../wishlistErrorMessage";
import type { WishlistMembershipCommandPort } from "../../ports/wishlistMembershipCommandPort";
import { WishlistModal } from "./WishlistModal";

vi.mock("../../queries", () => ({
  useWishlistListsReadQuery: vi.fn(),
}));

const mockUseWishlistListsReadQuery = vi.mocked(useWishlistListsReadQuery);
const scope: AuthenticatedSessionScope = {
  subject: "subject:member_a" as SessionSubject,
  epoch: 3,
  runtimeLeaseId: testSessionRuntimeLeaseId,
};
const wishlistPage: WishlistCollection = {
  wishlists: [
    {
      id: 1,
      name: "서울 여행",
      createdAt: "2026-08-29T00:00:00Z",
      thumbnailImageUrl: "https://example.com/seoul.jpg",
      itemCount: 2,
      containsAccommodation: false,
      wishlistAccommodationId: null,
    },
  ],
  pageInfo: { currentSize: 1, hasNext: false, nextCursor: null },
};

const createCommands = (): Mocked<WishlistMembershipCommandPort> => ({
  removeAccommodationFromAllWishlists: vi.fn(),
  addAccommodation: vi.fn().mockResolvedValue({
    status: "applied",
    isInAnyWishlist: true,
  }),
  createAndAddAccommodation: vi.fn().mockResolvedValue({
    status: "applied",
    isInAnyWishlist: true,
    wishlistId: 12,
  }),
  removeAccommodation: vi.fn().mockResolvedValue({
    status: "applied",
    isInAnyWishlist: false,
  }),
});

const mockQuery = (overrides: Record<string, unknown> = {}) => {
  const fetchNextPage = vi.fn().mockResolvedValue(undefined);
  const refetch = vi.fn().mockResolvedValue(undefined);
  mockUseWishlistListsReadQuery.mockReturnValue({
    data: { pageParams: [null], pages: [wishlistPage] },
    error: null,
    errorUpdatedAt: 0,
    fetchNextPage,
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch,
    ...overrides,
  } as never);
  return { fetchNextPage, refetch };
};

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof WishlistModal>> = {},
) => {
  const commands = createCommands();
  const onClose = vi.fn();
  const view = render(
    <WishlistModal
      accommodationId={7}
      commands={commands}
      isOpen
      onClose={onClose}
      scope={scope}
      {...overrides}
    />,
  );

  return { commands, onClose, ...view };
};

describe("WishlistModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery();
  });

  it("uses the explicit authenticated scope for its read query", () => {
    renderModal();

    expect(mockUseWishlistListsReadQuery).toHaveBeenCalledWith({
      accommodationId: 7,
      enabled: true,
      scope,
    });
    expect(
      screen.getByRole("dialog", { name: "위시리스트에 저장하기" }),
    ).toBeInTheDocument();
  });

  it("renders an accessible loading recipe for the initial read", () => {
    mockQuery({
      data: undefined,
      isFetching: true,
      isLoading: true,
    });

    renderModal();

    expect(screen.getByRole("status")).toHaveAttribute(
      "data-state-kind",
      "loading",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "위시리스트를 불러오는 중입니다.",
    );
  });

  it("renders a retryable cold error and refetches the existing query", async () => {
    const { refetch } = mockQuery({
      data: undefined,
      error: { code: "W001" },
      isError: true,
    });

    renderModal();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "위시리스트를 불러오지 못했어요",
    );
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("preserves cached modal items when a background refresh fails", () => {
    mockQuery({
      error: { code: "W001" },
      isError: true,
    });

    renderModal();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "최신 목록을 불러오지 못했어요",
    );
    expect(screen.getByRole("button", { name: /서울 여행/ })).toBeVisible();
  });

  it("explains the empty modal before offering collection creation", () => {
    mockQuery({
      data: {
        pageParams: [null],
        pages: [{ ...wishlistPage, wishlists: [] }],
      },
    });

    renderModal();

    expect(screen.getByRole("status")).toHaveTextContent(
      "아직 만든 위시리스트가 없어요",
    );
    expect(
      screen.getByRole("button", { name: "새로운 위시리스트 만들기" }),
    ).toBeEnabled();
  });

  it("declaratively replaces a failed wishlist thumbnail", () => {
    renderModal();

    fireEvent.error(screen.getByRole("img", { name: "서울 여행" }));

    expect(
      screen.queryByRole("img", { name: "서울 여행" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /서울 여행/ })).toBeVisible();
  });

  it("saves the selected wishlist and closes after success", async () => {
    const { commands, onClose } = renderModal();
    const itemButton = screen.getByRole("button", { name: /서울 여행/ });

    expect(itemButton).not.toHaveAttribute("aria-pressed");
    await userEvent.click(itemButton);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(commands.addAccommodation).toHaveBeenCalledExactlyOnceWith({
      accommodationId: 7,
      wishlistId: 1,
    });
    expect(commands.removeAccommodation).not.toHaveBeenCalled();
  });

  it("keeps an already saved wishlist intact and closes without another write", async () => {
    mockQuery({
      data: {
        pageParams: [null],
        pages: [
          {
            ...wishlistPage,
            wishlists: wishlistPage.wishlists.map((wishlist) => ({
              ...wishlist,
              containsAccommodation: true,
              wishlistAccommodationId: 10,
            })),
          },
        ],
      },
    });
    const { commands, onClose } = renderModal();

    await userEvent.click(
      screen.getByRole("button", { name: /서울 여행.*저장됨/ }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(commands.addAccommodation).not.toHaveBeenCalled();
    expect(commands.removeAccommodation).not.toHaveBeenCalled();
  });

  it("blocks duplicate UI submissions while the central command is pending", async () => {
    let resolve!: (result: {
      status: "applied";
      isInAnyWishlist: boolean;
    }) => void;
    const pending = new Promise<{
      status: "applied";
      isInAnyWishlist: boolean;
    }>((resolvePromise) => {
      resolve = resolvePromise;
    });
    const commands = createCommands();
    commands.addAccommodation.mockReturnValue(pending);
    const { onClose } = renderModal({ commands });
    const itemButton = screen.getByRole("button", { name: /서울 여행/ });

    await userEvent.click(itemButton);
    expect(itemButton).toBeDisabled();
    await userEvent.click(itemButton);
    expect(commands.addAccommodation).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "새로운 위시리스트 만들기" }),
    ).toBeDisabled();

    await act(async () => {
      resolve({ status: "applied", isInAnyWishlist: true });
      await pending;
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders command failures with the shared toast primitive", async () => {
    const commands = createCommands();
    commands.addAccommodation.mockRejectedValue({ code: "W001" });
    const { onClose } = renderModal({ commands });

    await userEvent.click(screen.getByRole("button", { name: /서울 여행/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "존재하지 않는 위시리스트입니다.",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /서울 여행/ })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "오류 닫기" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns after an applied mutation whose membership refresh is unconfirmed", async () => {
    const commands = createCommands();
    commands.addAccommodation.mockResolvedValue({
      status: "applied-unconfirmed",
      error: new Error("refresh failed"),
    });
    renderModal({ commands });

    await userEvent.click(screen.getByRole("button", { name: /서울 여행/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      WISHLIST_REFRESH_WARNING_MESSAGE,
    );
    expect(commands.addAccommodation).toHaveBeenCalledTimes(1);
  });

  it("closes the picker after creating a wishlist and saving the accommodation", async () => {
    const { commands, onClose } = renderModal();

    await userEvent.click(
      screen.getByRole("button", { name: "새로운 위시리스트 만들기" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "이름" }),
      "여름 여행",
    );
    await userEvent.click(screen.getByRole("button", { name: "새로 만들기" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(commands.createAndAddAccommodation).toHaveBeenCalledExactlyOnceWith({
      accommodationId: 7,
      name: "여름 여행",
    });
    expect(
      screen.queryByRole("dialog", { name: "위시리스트 만들기" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces an unconfirmed refresh after create without repeating create-and-add", async () => {
    const commands = createCommands();
    commands.createAndAddAccommodation.mockResolvedValue({
      status: "applied-unconfirmed",
      error: new Error("refresh failed"),
      wishlistId: 12,
    });
    renderModal({ commands });

    await userEvent.click(
      screen.getByRole("button", { name: "새로운 위시리스트 만들기" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "이름" }),
      "여름 여행",
    );
    await userEvent.click(screen.getByRole("button", { name: "새로 만들기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      WISHLIST_REFRESH_WARNING_MESSAGE,
    );
    expect(commands.createAndAddAccommodation).toHaveBeenCalledTimes(1);
  });

  it("suppresses a late in-flight result after the modal closes", async () => {
    let resolve!: (result: {
      status: "applied-unconfirmed";
      error: Error;
    }) => void;
    const pending = new Promise<{
      status: "applied-unconfirmed";
      error: Error;
    }>((resolvePromise) => {
      resolve = resolvePromise;
    });
    const commands = createCommands();
    commands.addAccommodation.mockReturnValue(pending);
    const { onClose, rerender } = renderModal({ commands });

    await userEvent.click(screen.getByRole("button", { name: /서울 여행/ }));
    await userEvent.click(screen.getByRole("button", { name: "닫기" }));
    rerender(
      <WishlistModal
        accommodationId={7}
        commands={commands}
        isOpen={false}
        onClose={onClose}
        scope={scope}
      />,
    );
    await act(async () => {
      resolve({
        status: "applied-unconfirmed",
        error: new Error("late refresh failure"),
      });
      await pending;
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(commands.addAccommodation).toHaveBeenCalledTimes(1);
  });

  it("closes without refetching or issuing any write", async () => {
    const { fetchNextPage } = mockQuery();
    const { commands, onClose } = renderModal();

    await userEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchNextPage).not.toHaveBeenCalled();
    expect(commands.addAccommodation).not.toHaveBeenCalled();
    expect(commands.removeAccommodation).not.toHaveBeenCalled();
    expect(commands.createAndAddAccommodation).not.toHaveBeenCalled();
  });
});
