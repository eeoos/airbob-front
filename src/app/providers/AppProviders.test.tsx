import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { Dialog, ToastHost } from "../../shared/ui";
import { APP_OVERLAY_ROOT_ID } from "../overlays/OverlayProvider";
import { AppProviders } from "./AppProviders";

jest.mock("../session/SessionProvider", () => ({
  SessionProvider: ({ children }: { readonly children: ReactNode }) => (
    <>{children}</>
  ),
}));
describe("AppProviders", () => {
  it("owns the canonical production portal for dialogs and toasts", () => {
    const view = render(
      <MemoryRouter>
        <AppProviders>
          <main data-testid="app-content">
            <Dialog isOpen title="프로덕션 대화상자" onClose={jest.fn()}>
              dialog content
            </Dialog>
            <ToastHost message="프로덕션 알림" onClose={jest.fn()} />
          </main>
        </AppProviders>
      </MemoryRouter>,
    );

    const portalRoot = screen.getByTestId(APP_OVERLAY_ROOT_ID);
    expect(portalRoot).toHaveAttribute("id", APP_OVERLAY_ROOT_ID);
    expect(portalRoot).toContainElement(
      screen.getByRole("dialog", { name: "프로덕션 대화상자" }),
    );
    expect(portalRoot).toContainElement(screen.getByRole("alert"));
    expect(screen.getByTestId("app-content")).not.toContainElement(
      screen.getByRole("dialog", { name: "프로덕션 대화상자" }),
    );

    view.unmount();
    expect(screen.queryByTestId(APP_OVERLAY_ROOT_ID)).not.toBeInTheDocument();
  });
});
