import {
  adjustInfoWindowIntoMapView,
  applyInfoWindowChromeStyles,
} from "./infoWindowDom";

const mockRect = (
  element: HTMLElement,
  rect: Partial<DOMRect> & Pick<DOMRect, "left" | "top" | "width" | "height">
) => {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      toJSON: () => ({}),
    }),
  });
};

describe("info window DOM helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("adjusts an overflowing info window relative to the map viewport", () => {
    const mapElement = document.createElement("div");
    const parent = document.createElement("div");
    const infoWindow = document.createElement("div");
    infoWindow.className = "gm-style-iw-c";
    parent.style.transform = "translate(10px, 5px)";
    parent.appendChild(infoWindow);
    document.body.append(mapElement, parent);

    mockRect(mapElement, { left: 0, top: 0, width: 300, height: 240 });
    mockRect(infoWindow, { left: 280, top: 220, width: 327, height: 80 });

    const didAdjust = adjustInfoWindowIntoMapView({ mapElement });

    expect(didAdjust).toBe(true);
    expect(parent.style.transform).toBe("translate(-317px, -75px)");
  });

  it("leaves an in-bounds info window transform unchanged", () => {
    const mapElement = document.createElement("div");
    const parent = document.createElement("div");
    const infoWindow = document.createElement("div");
    infoWindow.className = "gm-style-iw-c";
    parent.style.transform = "translate(4px, 8px)";
    parent.appendChild(infoWindow);
    document.body.append(mapElement, parent);

    mockRect(mapElement, { left: 0, top: 0, width: 500, height: 320 });
    mockRect(infoWindow, { left: 80, top: 40, width: 327, height: 100 });

    const didAdjust = adjustInfoWindowIntoMapView({ mapElement });

    expect(didAdjust).toBe(false);
    expect(parent.style.transform).toBe("translate(4px, 8px)");
  });

  it("applies Google Maps info window chrome overrides and removes default close controls", () => {
    const content = document.createElement("div");
    content.className = "gm-style-iw-d";
    const container = document.createElement("div");
    container.className = "gm-style-iw-c";
    const closeContainer = document.createElement("div");
    closeContainer.className = "gm-style-iw-chr";
    const closeButton = document.createElement("button");
    closeButton.className = "gm-ui-hover-effect";
    const emptyCloseWrapper = document.createElement("div");
    emptyCloseWrapper.className = "gm-style-iw-ch";
    document.body.append(content, container, closeContainer, closeButton, emptyCloseWrapper);

    applyInfoWindowChromeStyles();

    expect(content.style.padding).toBe("0px");
    expect(content.style.background).toBe("transparent");
    expect(container.style.borderRadius).toBe("12px");
    expect(container.style.overflow).toBe("hidden");
    expect(document.querySelector(".gm-style-iw-chr")).toBeNull();
    expect(document.querySelector(".gm-ui-hover-effect")).toBeNull();
    expect(document.querySelector(".gm-style-iw-ch")).toBeNull();
  });
});
