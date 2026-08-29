import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../../platform/session/sessionScope";
import type { WishlistCollection } from "../../model";
import { useWishlistListsReadQuery } from "../../queries";
import { WISHLIST_REFRESH_WARNING_MESSAGE } from "../wishlistErrorMessage";
import type { WishlistMembershipCommandPort } from "../../ports/wishlistMembershipCommandPort";
import { WishlistModal } from "./WishlistModal";

jest.mock("../../queries", () => ({
  useWishlistListsReadQuery: jest.fn(),
}));

const mockUseWishlistListsReadQuery = jest.mocked(
  useWishlistListsReadQuery,
);
const scope: AuthenticatedSessionScope = {
  subject: "subject:member_a" as SessionSubject,
  epoch: 3,
};
const wishlistPage: WishlistCollection = {
  wishlists: [
    {
      id: 1,
      name: "서울 여행",
      createdAt: "2026-08-29T00:00:00Z",
      thumbnailImageUrl: "https://example.com/seoul.jpg",
      itemCount: 2,
      containsAccommodation: true,
      wishlistAccommodationId: 10,
    },
  ],
  pageInfo: { currentSize: 1, hasNext: false, nextCursor: null },
};

const createCommands = (): jest.Mocked<WishlistMembershipCommandPort> => ({
  addAccommodation: jest.fn().mockResolvedValue({
    status: "applied",
    isInAnyWishlist: true,
  }),
  createAndAddAccommodation: jest.fn().mockResolvedValue({
    status: "applied",
    isInAnyWishlist: true,
    wishlistId: 12,
  }),
  removeAccommodation: jest.fn().mockResolvedValue({
    status: "applied",
    isInAnyWishlist: false,
  }),
});

const mockQuery = (
  overrides: Record<string, unknown> = {},
) => {
  const fetchNextPage = jest.fn().mockResolvedValue(undefined);
  mockUseWishlistListsReadQuery.mockReturnValue({
    data: { pageParams: [null], pages: [wishlistPage] },
    error: null,
    errorUpdatedAt: 0,
    fetchNextPage,
    hasNextPage: false,
    isFetching: false,
    isFetchingNextPage: false,
    isLoading: false,
    ...overrides,
  } as never);
  return { fetchNextPage };
};

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof WishlistModal>> = {},
) => {
  const commands = createCommands();
  const onClose = jest.fn();
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
    jest.clearAllMocks();
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

  it("routes item writes through the injected command port", async () => {
    const { commands } = renderModal();
    const itemButton = screen.getByRole("button", { name: /서울 여행/ });

    expect(itemButton).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(itemButton);

    await waitFor(() =>
      expect(commands.removeAccommodation).toHaveBeenCalledWith({
        accommodationId: 7,
        wishlistAccommodationId: 10,
      }),
    );
    expect(commands.addAccommodation).not.toHaveBeenCalled();
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
    commands.removeAccommodation.mockReturnValue(pending);
    renderModal({ commands });
    const itemButton = screen.getByRole("button", { name: /서울 여행/ });

    await userEvent.click(itemButton);
    expect(itemButton).toBeDisabled();
    await userEvent.click(itemButton);
    expect(commands.removeAccommodation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ status: "applied", isInAnyWishlist: false });
      await pending;
    });
    expect(itemButton).not.toBeDisabled();
  });

  it("renders command failures with the shared toast primitive", async () => {
    const commands = createCommands();
    commands.removeAccommodation.mockRejectedValue({ code: "W003" });
    renderModal({ commands });

    await userEvent.click(screen.getByRole("button", { name: /서울 여행/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "존재하지 않는 위시리스트 항목입니다.",
    );
    await userEvent.click(screen.getByRole("button", { name: "오류 닫기" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns after an applied mutation whose membership refresh is unconfirmed", async () => {
    const commands = createCommands();
    commands.removeAccommodation.mockResolvedValue({
      status: "applied-unconfirmed",
      error: new Error("refresh failed"),
    });
    renderModal({ commands });

    await userEvent.click(screen.getByRole("button", { name: /서울 여행/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      WISHLIST_REFRESH_WARNING_MESSAGE,
    );
    expect(commands.removeAccommodation).toHaveBeenCalledTimes(1);
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
    commands.removeAccommodation.mockReturnValue(pending);
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
    expect(commands.removeAccommodation).toHaveBeenCalledTimes(1);
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
