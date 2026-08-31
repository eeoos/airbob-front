import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverlayProvider } from "../../app/overlays/OverlayProvider";
import { AuthController } from "./AuthController";

const renderController = (element: React.ReactElement) =>
  render(<OverlayProvider>{element}</OverlayProvider>);

describe("AuthController", () => {
  it("submits login credentials and completes the safe continuation", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    renderController(
      <AuthController
        mode="login"
        submitLogin={login}
        canComplete={() => true}
        onSuccess={onSuccess}
        onAlternate={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText("이메일"), "guest@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "guest@example.com",
        password: "password123",
      });
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("does not run a stale continuation after the completion guard changes", async () => {
    let resolveLogin!: () => void;
    const login = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const onSuccess = vi.fn();
    const canComplete = vi.fn(() => false);

    renderController(
      <AuthController
        mode="login"
        submitLogin={login}
        canComplete={canComplete}
        onSuccess={onSuccess}
        onAlternate={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText("이메일"), "guest@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await act(async () => resolveLogin());

    expect(canComplete).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("retains a failed signup form and navigates only after success", async () => {
    const signup = vi
      .fn()
      .mockRejectedValueOnce(new Error("이미 존재하는 이메일입니다."));
    const onSuccess = vi.fn();

    renderController(
      <AuthController
        mode="signup"
        submitSignup={signup}
        canComplete={() => true}
        onSuccess={onSuccess}
        onAlternate={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText("닉네임"), "airbob");
    await userEvent.type(screen.getByLabelText("이메일"), "used@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.type(screen.getByLabelText("비밀번호 확인"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "회원가입" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "이미 존재하는 이메일입니다.",
    );
    expect(screen.getByLabelText("이메일")).toHaveValue("used@example.com");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("invalidates an in-flight completion before alternate navigation", async () => {
    let resolveLogin!: () => void;
    const login = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const onAlternate = vi.fn();
    const onSuccess = vi.fn();

    renderController(
      <AuthController
        mode="login"
        submitLogin={login}
        canComplete={() => true}
        onSuccess={onSuccess}
        onAlternate={onAlternate}
      />,
    );
    await userEvent.type(screen.getByLabelText("이메일"), "guest@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    await userEvent.click(screen.getByRole("button", { name: "회원가입" }));
    await act(async () => resolveLogin());

    expect(onAlternate).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("invalidates an in-flight completion when the controller unmounts", async () => {
    let resolveLogin!: () => void;
    const login = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const canComplete = vi.fn(() => true);
    const onSuccess = vi.fn();
    const { unmount } = renderController(
      <AuthController
        mode="login"
        submitLogin={login}
        canComplete={canComplete}
        onSuccess={onSuccess}
        onAlternate={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText("이메일"), "guest@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(login).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      resolveLogin();
      await Promise.resolve();
    });

    expect(canComplete).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
