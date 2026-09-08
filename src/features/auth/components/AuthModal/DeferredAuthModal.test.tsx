import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { renderApp } from "../../../../test/renderApp";
import type { AuthModalProps } from "./AuthModal";
import { DeferredAuthModal } from "./DeferredAuthModal";

vi.mock("../../../../platform/logging/clientLogger", () => ({
  clientLogger: { error: vi.fn() },
}));

const LoadedAuthModal: ComponentType<AuthModalProps> = ({ initialMode }) => (
  <div data-testid="loaded-auth-modal">{initialMode}</div>
);

describe("DeferredAuthModal", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => consoleErrorSpy.mockRestore());

  it("shows a visible loading dialog until the account surface is ready", async () => {
    let resolveLoader!: (module: {
      default: ComponentType<AuthModalProps>;
    }) => void;
    const loadAuthModal = vi.fn(
      () =>
        new Promise<{ default: ComponentType<AuthModalProps> }>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    renderApp(
      <DeferredAuthModal
        initialMode="signup"
        isOpen
        loadAuthModal={loadAuthModal}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "회원가입" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "계정 화면을 불러오는 중입니다.",
    );

    await act(async () => {
      resolveLoader({ default: LoadedAuthModal });
    });

    expect(await screen.findByTestId("loaded-auth-modal")).toHaveTextContent(
      "signup",
    );
  });

  it("retries a rejected account chunk without replacing the whole app", async () => {
    const loadAuthModal = vi
      .fn()
      .mockRejectedValueOnce(new Error("chunk unavailable"))
      .mockResolvedValueOnce({ default: LoadedAuthModal });

    renderApp(
      <DeferredAuthModal
        isOpen
        loadAuthModal={loadAuthModal}
        onClose={vi.fn()}
      />,
    );

    expect(
      await screen.findByText("계정 화면을 불러오지 못했어요"),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByTestId("loaded-auth-modal")).toBeVisible();
    expect(loadAuthModal).toHaveBeenCalledTimes(2);
  });
});
