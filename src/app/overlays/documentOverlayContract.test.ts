import { readFileSync } from "fs";
import { join } from "path";
import { APP_OVERLAY_ROOT_ID } from "./OverlayProvider";

describe("overlay document contract", () => {
  it("declares Korean content and the app overlay root in the HTML source and DOM", () => {
    const source = readFileSync(
      join(process.cwd(), "public/index.html"),
      "utf8",
    );
    const parsedDocument = new DOMParser().parseFromString(source, "text/html");

    expect(source).toContain('<html lang="ko">');
    expect(source).toContain(`<div id="${APP_OVERLAY_ROOT_ID}"></div>`);
    expect(parsedDocument.documentElement.lang).toBe("ko");
    expect(parsedDocument.getElementById(APP_OVERLAY_ROOT_ID)).not.toBeNull();
  });
});
