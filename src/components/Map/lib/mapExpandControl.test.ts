import { renderMapExpandControl } from "./mapExpandControl";

describe("map expand control helper", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("creates a map expand button that calls the toggle handler without bubbling", () => {
    const onToggle = jest.fn();
    const onContainerClick = jest.fn();
    container.addEventListener("click", onContainerClick);

    const button = renderMapExpandControl({
      container,
      isExpanded: false,
      onToggle,
    });

    expect(container.querySelectorAll(".map-expand-button")).toHaveLength(1);
    expect(button.innerHTML).toContain("M7 14H5v5h5v-2H7v-3");

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onContainerClick).not.toHaveBeenCalled();
  });

  it("updates the existing button instead of appending duplicates", () => {
    const onToggle = jest.fn();
    const firstButton = renderMapExpandControl({
      container,
      isExpanded: false,
      onToggle,
    });

    const secondButton = renderMapExpandControl({
      container,
      isExpanded: true,
      onToggle,
    });

    expect(container.querySelectorAll(".map-expand-button")).toHaveLength(1);
    expect(secondButton).toBe(firstButton);
    expect(secondButton.innerHTML).toContain("M5 16h3v3h2v-5H5v2");

    secondButton.dispatchEvent(new MouseEvent("mouseenter"));
    expect(secondButton.style.backgroundColor).toBe("rgb(247, 247, 247)");

    secondButton.dispatchEvent(new MouseEvent("mouseleave"));
    expect(secondButton.style.backgroundColor).toBe("white");
  });
});
