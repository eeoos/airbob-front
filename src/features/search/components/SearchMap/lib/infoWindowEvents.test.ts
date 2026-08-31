import { bindInfoWindowEvents } from "./infoWindowEvents";

describe("info window delegated events", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.innerHTML = `
      <button
        type="button"
        data-info-window-action="wishlist"
        data-accommodation-id="10"
        data-is-in-wishlist="true"
      >
        <span>heart</span>
      </button>
      <button type="button" data-info-window-action="close">close</button>
      <p>card body</p>
    `;
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("calls the card click handler for regular root clicks", () => {
    const onCardClick = vi.fn();

    bindInfoWindowEvents({
      root,
      onCardClick,
      onClose: vi.fn(),
      onWishlistToggle: vi.fn(),
    });

    root.querySelector("p")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    expect(onCardClick).toHaveBeenCalledTimes(1);
  });

  it("stops propagation and calls wishlist toggle with data attributes", () => {
    const onCardClick = vi.fn();
    const onWishlistToggle = vi.fn();
    const onContainerClick = vi.fn();
    const container = document.createElement("div");
    container.appendChild(root);
    document.body.appendChild(container);
    container.addEventListener("click", onContainerClick);

    bindInfoWindowEvents({
      root,
      onCardClick,
      onClose: vi.fn(),
      onWishlistToggle,
    });

    root.querySelector("span")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    expect(onWishlistToggle).toHaveBeenCalledWith(10, true);
    expect(onCardClick).not.toHaveBeenCalled();
    expect(onContainerClick).not.toHaveBeenCalled();
  });

  it("ignores wishlist clicks with unsafe ids", () => {
    const onWishlistToggle = vi.fn();
    const wishlistButton = root.querySelector<HTMLElement>(
      '[data-info-window-action="wishlist"]',
    );
    wishlistButton?.setAttribute("data-accommodation-id", "10.5");

    bindInfoWindowEvents({
      root,
      onCardClick: vi.fn(),
      onClose: vi.fn(),
      onWishlistToggle,
    });

    wishlistButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onWishlistToggle).not.toHaveBeenCalled();
  });

  it("stops propagation and calls close for close clicks", () => {
    const onClose = vi.fn();
    const onCardClick = vi.fn();
    const onContainerClick = vi.fn();
    const container = document.createElement("div");
    container.appendChild(root);
    document.body.appendChild(container);
    container.addEventListener("click", onContainerClick);

    bindInfoWindowEvents({
      root,
      onCardClick,
      onClose,
      onWishlistToggle: vi.fn(),
    });

    root
      .querySelector('[data-info-window-action="close"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
    expect(onContainerClick).not.toHaveBeenCalled();
  });

  it("removes the delegated click listener during cleanup", () => {
    const onCardClick = vi.fn();
    const cleanup = bindInfoWindowEvents({
      root,
      onCardClick,
      onClose: vi.fn(),
      onWishlistToggle: vi.fn(),
    });

    cleanup();

    root.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onCardClick).not.toHaveBeenCalled();
  });
});
