interface RenderMapExpandControlOptions {
  container: HTMLElement;
  isExpanded: boolean;
  onToggle: () => void;
}

const MAP_EXPAND_BUTTON_CLASS = "map-expand-button";

const collapseIconSvg = `
  <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px;">
    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
  </svg>
`;

const expandIconSvg = `
  <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px;">
    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
  </svg>
`;

const applyMapExpandControlStyles = (button: HTMLButtonElement) => {
  button.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    width: 40px;
    height: 40px;
    background: white;
    border: none;
    border-radius: 2px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    cursor: pointer;
    z-index: var(--z-popover);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #222222;
    transition: background-color 0.2s ease;
  `;
};

export const renderMapExpandControl = ({
  container,
  isExpanded,
  onToggle,
}: RenderMapExpandControlOptions) => {
  let button = container.querySelector<HTMLButtonElement>(
    `.${MAP_EXPAND_BUTTON_CLASS}`
  );

  if (!button) {
    button = document.createElement("button");
    button.className = MAP_EXPAND_BUTTON_CLASS;
    button.type = "button";
    container.appendChild(button);
  }

  const controlButton = button;

  applyMapExpandControlStyles(controlButton);
  controlButton.innerHTML = isExpanded ? collapseIconSvg : expandIconSvg;
  controlButton.setAttribute(
    "aria-label",
    isExpanded ? "지도 축소" : "지도 확대"
  );

  controlButton.onmouseenter = () => {
    controlButton.style.backgroundColor = "#f7f7f7";
  };
  controlButton.onmouseleave = () => {
    controlButton.style.backgroundColor = "white";
  };
  controlButton.onclick = (event) => {
    event.stopPropagation();
    onToggle();
  };

  return controlButton;
};
