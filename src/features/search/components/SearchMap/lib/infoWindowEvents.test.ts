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
    const onCardClick = jest.fn();

    bindInfoWindowEvents({
      root,
      onCardClick,
      onClose: jest.fn(),
      onWishlistToggle: jest.fn(),
    });

    root.querySelector("p")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    expect(onCardClick).toHaveBeenCalledTimes(1);
  });

  it("stops propagation and calls wishlist toggle with data attributes", () => {
    const onCardClick = jest.fn();
    const onWishlistToggle = jest.fn();
    const onContainerClick = jest.fn();
    const container = document.createElement("div");
    container.appendChild(root);
    document.body.appendChild(container);
    container.addEventListener("click", onContainerClick);

    bindInfoWindowEvents({
      root,
      onCardClick,
      onClose: jest.fn(),
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
    const onWishlistToggle = jest.fn();
    const wishlistButton = root.querySelector<HTMLElement>(
      '[data-info-window-action="wishlist"]',
    );
    wishlistButton?.setAttribute("data-accommodation-id", "10.5");

    bindInfoWindowEvents({
      root,
      onCardClick: jest.fn(),
      onClose: jest.fn(),
      onWishlistToggle,
    });

    wishlistButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onWishlistToggle).not.toHaveBeenCalled();
  });

  it("stops propagation and calls close for close clicks", () => {
    const onClose = jest.fn();
    const onCardClick = jest.fn();
    const onContainerClick = jest.fn();
    const container = document.createElement("div");
    container.appendChild(root);
    document.body.appendChild(container);
    container.addEventListener("click", onContainerClick);

    bindInfoWindowEvents({
      root,
      onCardClick,
      onClose,
      onWishlistToggle: jest.fn(),
    });

    root
      .querySelector('[data-info-window-action="close"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
    expect(onContainerClick).not.toHaveBeenCalled();
  });

  it("removes the delegated click listener during cleanup", () => {
    const onCardClick = jest.fn();
    const cleanup = bindInfoWindowEvents({
      root,
      onCardClick,
      onClose: jest.fn(),
      onWishlistToggle: jest.fn(),
    });

    cleanup();

    root.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onCardClick).not.toHaveBeenCalled();
  });
});
