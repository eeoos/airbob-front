import {
  MAP_EXPAND_CONTROL_STYLE_TOKENS,
  renderMapExpandControl,
} from "./mapExpandControl";

describe("map expand control helper", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("keeps inline DOM style values behind named constants", () => {
    expect(MAP_EXPAND_CONTROL_STYLE_TOKENS).toMatchObject({
      background: "var(--color-background-page)",
      backgroundHover: "var(--color-background-muted)",
      iconSize: "20px",
      size: "40px",
      zIndex: "var(--z-popover)",
    });
  });

  it("creates a map expand button that calls the toggle handler without bubbling", () => {
    const onToggle = jest.fn();
    const onContainerClick = jest.fn();
    container.addEventListener("click", onContainerClick);

    const view = renderMapExpandControl({
      container,
      isExpanded: false,
      onToggle,
    });

    expect(container.querySelectorAll(".map-expand-button")).toHaveLength(1);
    expect(view.innerHTML).toContain("M7 14H5v5h5v-2H7v-3");

    view.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onContainerClick).not.toHaveBeenCalled();
  });

  it("updates the existing button instead of appending duplicates", () => {
    const onToggle = jest.fn();
    const view = renderMapExpandControl({
      container,
      isExpanded: false,
      onToggle,
    });

    const utils = renderMapExpandControl({
      container,
      isExpanded: true,
      onToggle,
    });

    expect(container.querySelectorAll(".map-expand-button")).toHaveLength(1);
    expect(utils).toBe(view);
    expect(utils.innerHTML).toContain("M5 16h3v3h2v-5H5v2");

    utils.dispatchEvent(new MouseEvent("mouseenter"));
    expect(
      utils.style.getPropertyValue("--map-expand-control-background")
    ).toBe("var(--color-background-muted)");

    utils.dispatchEvent(new MouseEvent("mouseleave"));
    expect(
      utils.style.getPropertyValue("--map-expand-control-background")
    ).toBe("var(--color-background-page)");
  });
});
