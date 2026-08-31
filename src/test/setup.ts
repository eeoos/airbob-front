import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => {
  document.getElementById("airbob-portal-root")?.remove();
});
