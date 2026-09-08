import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import type { SessionSubject } from "../../../../platform/session/sessionScope";
import { renderApp } from "../../../../test/renderApp";
import { testSessionRuntimeLeaseId } from "../../../../test/sessionFixtures";
import { DeferredWishlistModal } from "./DeferredWishlistModal";
import type { WishlistModalProps } from "./WishlistModal";

const props: WishlistModalProps = {
  accommodationId: 7,
  commands: {} as WishlistModalProps["commands"],
  isOpen: true,
  onClose: vi.fn(),
  scope: {
    subject: "subject:wishlist_guest" as SessionSubject,
    epoch: 3,
    runtimeLeaseId: testSessionRuntimeLeaseId,
  },
};
const LoadedModal: ComponentType<WishlistModalProps> = ({
  accommodationId,
}) => <h2>불러온 위시리스트 {accommodationId}</h2>;
const deferredModule = () => {
  let resolve!: (module: {
    WishlistModal: ComponentType<WishlistModalProps>;
  }) => void;
  const promise = new Promise<{
    WishlistModal: ComponentType<WishlistModalProps>;
  }>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe("DeferredWishlistModal", () => {
  it("loads only when opened and forwards the current listing after loading", async () => {
    const pending = deferredModule();
    const loadWishlistModal = vi.fn(() => pending.promise);
    const { rerender } = renderApp(
      <DeferredWishlistModal
        {...props}
        isOpen={false}
        loadWishlistModal={loadWishlistModal}
      />,
    );
    expect(loadWishlistModal).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(
      <DeferredWishlistModal
        {...props}
        loadWishlistModal={loadWishlistModal}
      />,
    );
    await waitFor(() => expect(loadWishlistModal).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("dialog", { name: "위시리스트에 저장하기" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "위시리스트 화면을 불러오고 있어요",
    );
    rerender(
      <DeferredWishlistModal
        {...props}
        accommodationId={42}
        loadWishlistModal={loadWishlistModal}
      />,
    );
    await act(async () => {
      pending.resolve({ WishlistModal: LoadedModal });
    });
    expect(
      await screen.findByRole("heading", { name: "불러온 위시리스트 42" }),
    ).toBeVisible();
    expect(loadWishlistModal).toHaveBeenCalledTimes(1);
  });

  it("retries a failed chunk inside the modal", async () => {
    const loadWishlistModal = vi
      .fn()
      .mockRejectedValueOnce(new Error("synthetic chunk failure"))
      .mockResolvedValueOnce({ WishlistModal: LoadedModal });
    renderApp(
      <DeferredWishlistModal
        {...props}
        loadWishlistModal={loadWishlistModal}
      />,
    );
    expect(
      await screen.findByRole("heading", {
        name: "위시리스트 화면을 불러오지 못했어요",
      }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(
      await screen.findByRole("heading", { name: "불러온 위시리스트 7" }),
    ).toBeVisible();
    expect(loadWishlistModal).toHaveBeenCalledTimes(2);
  });

  it("allows closing during loading and ignores the late completion", async () => {
    const pending = deferredModule();
    const loadWishlistModal = vi.fn(() => pending.promise);
    const onClose = vi.fn();
    const { rerender } = renderApp(
      <DeferredWishlistModal
        {...props}
        onClose={onClose}
        loadWishlistModal={loadWishlistModal}
      />,
    );
    await waitFor(() => expect(loadWishlistModal).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <DeferredWishlistModal
        {...props}
        isOpen={false}
        loadWishlistModal={loadWishlistModal}
      />,
    );
    await act(async () => {
      pending.resolve({ WishlistModal: LoadedModal });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "불러온 위시리스트 7" }),
    ).not.toBeInTheDocument();
  });
});
