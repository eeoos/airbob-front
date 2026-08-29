import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WishlistMembershipCommandPort } from "../../ports/wishlistMembershipCommandPort";
import { WISHLIST_CREATED_ONLY_MESSAGE } from "../wishlistErrorMessage";
import { CreateWishlistModal } from "./CreateWishlistModal";

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

const renderCreateModal = (
  overrides: Partial<React.ComponentProps<typeof CreateWishlistModal>> = {},
) => {
  const commands = createCommands();
  const onClose = jest.fn();
  const onComplete = jest.fn();
  const view = render(
    <CreateWishlistModal
      accommodationId={7}
      commands={commands}
      isOpen
      onClose={onClose}
      onComplete={onComplete}
      {...overrides}
    />,
  );

  return { commands, onClose, onComplete, ...view };
};

describe("CreateWishlistModal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("submits a trimmed name through the injected command port", async () => {
    const { commands, onComplete } = renderCreateModal();

    await userEvent.type(
      screen.getByRole("textbox", { name: "이름" }),
      "  여름 여행  ",
    );
    await userEvent.click(screen.getByRole("button", { name: "새로 만들기" }));

    await waitFor(() =>
      expect(commands.createAndAddAccommodation).toHaveBeenCalledWith({
        accommodationId: 7,
        name: "여름 여행",
      }),
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ status: "applied" }),
    );
  });

  it("retains the name after partial success so retry reuses the created list", async () => {
    const commands = createCommands();
    commands.createAndAddAccommodation
      .mockResolvedValueOnce({
        status: "created-only",
        wishlistId: 12,
        error: new Error("add failed"),
      })
      .mockResolvedValueOnce({
        status: "applied",
        isInAnyWishlist: true,
        wishlistId: 12,
      });
    const onComplete = jest.fn();
    renderCreateModal({ commands, onComplete });
    const input = screen.getByRole("textbox", { name: "이름" });

    await userEvent.type(input, "여름 여행");
    await userEvent.click(screen.getByRole("button", { name: "새로 만들기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      WISHLIST_CREATED_ONLY_MESSAGE,
    );
    expect(input).toHaveValue("여름 여행");

    await userEvent.click(screen.getByRole("button", { name: "새로 만들기" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(commands.createAndAddAccommodation).toHaveBeenCalledTimes(2);
  });

  it("closes without invoking a command", async () => {
    const { commands, onClose } = renderCreateModal();

    await userEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(commands.createAndAddAccommodation).not.toHaveBeenCalled();
  });
});
