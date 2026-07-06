import { render, screen } from "@testing-library/react";
import { OverlaySurface } from "./OverlaySurface";
import styles from "./OverlaySurface.module.css";

describe("OverlaySurface", () => {
  it("renders popovers as labelled dialogs by default", () => {
    render(
      <OverlaySurface variant="popover" aria-label="필터">
        필터 내용
      </OverlaySurface>
    );

    expect(screen.getByRole("dialog", { name: "필터" })).toBeInTheDocument();
  });

  it("allows callers to override the accessibility role", () => {
    render(
      <OverlaySurface variant="popover" role="menu" aria-label="정렬">
        정렬 내용
      </OverlaySurface>
    );

    expect(screen.getByRole("menu", { name: "정렬" })).toBeInTheDocument();
  });

  it("applies variant classes for bottom sheets and dialogs", () => {
    render(
      <>
        <OverlaySurface variant="bottom-sheet" aria-label="예약 옵션">
          예약 내용
        </OverlaySurface>
        <OverlaySurface variant="dialog" aria-label="확인">
          확인 내용
        </OverlaySurface>
      </>
    );

    expect(screen.getByRole("dialog", { name: "예약 옵션" })).toHaveClass(
      styles.bottomSheet
    );
    expect(screen.getByRole("dialog", { name: "확인" })).toHaveClass(
      styles.dialog
    );
  });
});
