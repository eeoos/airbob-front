import { render, screen } from "@testing-library/react";
import { OverlaySurface } from "./OverlaySurface";
import styles from "./OverlaySurface.module.css";

const unnamedDialogVariantSurface = (
  // @ts-expect-error dialog variant surfaces require an accessible name.
  <OverlaySurface variant="dialog">내용</OverlaySurface>
);
void unnamedDialogVariantSurface;

describe("OverlaySurface", () => {
  it("renders popovers as groups by default", () => {
    render(
      <OverlaySurface variant="popover">
        필터 내용
      </OverlaySurface>
    );

    expect(screen.getByRole("group")).toHaveClass(styles.popover);
  });

  it("allows callers to override the accessibility role", () => {
    render(
      <OverlaySurface variant="popover" role="menu" aria-label="정렬">
        정렬 내용
      </OverlaySurface>
    );

    expect(screen.getByRole("menu", { name: "정렬" })).toBeInTheDocument();
  });

  it("requires dialog role surfaces to have an accessible name", () => {
    expect(() =>
      render(
        <OverlaySurface {...({ role: "dialog" } as any)}>
          확인 내용
        </OverlaySurface>
      )
    ).toThrow("OverlaySurface dialog role requires an accessible name.");
  });

  it("applies variant classes for bottom sheets and dialogs", () => {
    render(
      <>
        <OverlaySurface variant="bottom-sheet">
          예약 내용
        </OverlaySurface>
        <OverlaySurface variant="dialog" aria-label="확인">
          확인 내용
        </OverlaySurface>
      </>
    );

    expect(screen.getByRole("group")).toHaveClass(styles.bottomSheet);
    expect(screen.getByRole("dialog", { name: "확인" })).toHaveClass(
      styles.dialog
    );
  });
});
