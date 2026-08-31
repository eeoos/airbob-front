import { readFileSync } from "fs";
import { join } from "path";
import { APP_OVERLAY_ROOT_ID, APP_ROOT_ID } from "./OverlayProvider";

describe("overlay document contract", () => {
  it("declares Korean metadata and both app mount roots in the HTML document", () => {
    const source = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const parsedDocument = new DOMParser().parseFromString(source, "text/html");

    expect(source).toContain('<html lang="ko">');
    expect(source).toContain(`<div id="${APP_ROOT_ID}"></div>`);
    expect(source).toContain(`<div id="${APP_OVERLAY_ROOT_ID}"></div>`);
    expect(parsedDocument.documentElement.lang).toBe("ko");
    expect(parsedDocument.title).toBe("에어밥");
    expect(
      parsedDocument
        .querySelector('meta[name="description"]')
        ?.getAttribute("content"),
    ).toBe("에어밥 - 특별한 숙소를 찾아보세요");
    expect(parsedDocument.getElementById(APP_ROOT_ID)).not.toBeNull();
    expect(parsedDocument.getElementById(APP_OVERLAY_ROOT_ID)).not.toBeNull();
  });
});
