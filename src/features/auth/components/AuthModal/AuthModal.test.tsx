import React from "react";
import type { Mocked } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AuthCommandProvider,
  type AuthCommandPort,
} from "../../ports/AuthCommandProvider";
import { AuthModal } from "./AuthModal";

const createCommands = (
  overrides: Partial<Mocked<AuthCommandPort>> = {},
): Mocked<AuthCommandPort> => ({
  login: vi.fn().mockResolvedValue(undefined),
  signup: vi.fn().mockResolvedValue(undefined),
  shouldCompleteLoginInCurrentView: vi.fn(() => true),
  ...overrides,
});

const renderAuthModal = (
  element: React.ReactElement,
  commands = createCommands(),
) => ({
  commands,
  ...render(
    <AuthCommandProvider commands={commands}>
      {element}
    </AuthCommandProvider>,
  ),
});

describe("AuthModal", () => {
  it("renders the login form inside the shared accessible dialog", () => {
    renderAuthModal(
      <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />,
    );

    expect(screen.getByRole("dialog", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  });

  it("validates signup locally and dismisses the error toast", async () => {
    const { commands } = renderAuthModal(
      <AuthModal isOpen={true} onClose={vi.fn()} initialMode="signup" />,
    );

    await userEvent.type(screen.getByLabelText("닉네임"), "airbob");
    await userEvent.type(screen.getByLabelText("이메일"), "user@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.type(
      screen.getByLabelText("비밀번호 확인"),
      "different123",
    );
    await userEvent.click(screen.getByRole("button", { name: "회원가입" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("비밀번호가 일치하지 않습니다.");
    expect(commands.signup).not.toHaveBeenCalled();

    await userEvent.click(
      within(alert).getByRole("button", { name: "오류 닫기" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("closes and runs the success callback after a current login", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const { commands } = renderAuthModal(
      <AuthModal
        isOpen={true}
        onClose={onClose}
        initialMode="login"
        onSuccess={onSuccess}
      />,
    );

    await userEvent.type(screen.getByLabelText("이메일"), "user@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(commands.login).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not replay success when the modal closes before login resolves", async () => {
    let resolveLogin!: () => void;
    const commands = createCommands({
      login: vi.fn<AuthCommandPort["login"]>(
        (_credentials) =>
          new Promise<void>((resolve) => {
            resolveLogin = resolve;
          }),
      ),
    });
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const { rerender } = renderAuthModal(
      <AuthModal
        isOpen={true}
        onClose={onClose}
        initialMode="login"
        onSuccess={onSuccess}
      />,
      commands,
    );

    await userEvent.type(screen.getByLabelText("이메일"), "user@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    await waitFor(() => expect(commands.login).toHaveBeenCalledTimes(1));

    rerender(
      <AuthCommandProvider commands={commands}>
        <AuthModal
          isOpen={false}
          onClose={onClose}
          initialMode="login"
          onSuccess={onSuccess}
        />
      </AuthCommandProvider>,
    );

    await act(async () => resolveLogin());

    expect(onClose).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("retains the exact form and error after a failed login", async () => {
    const failure = new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    const commands = createCommands({
      login: vi.fn().mockRejectedValue(failure),
    });

    renderAuthModal(
      <AuthModal isOpen={true} onClose={vi.fn()} />,
      commands,
    );

    await userEvent.type(screen.getByLabelText("이메일"), "guest@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(failure.message);
    expect(screen.getByLabelText("이메일")).toHaveValue("guest@example.com");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("wrong-password");
  });

  it("does not execute a callback rejected by the current-view guard", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const commands = createCommands({
      shouldCompleteLoginInCurrentView: vi.fn(() => false),
    });

    renderAuthModal(
      <AuthModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
      commands,
    );

    await userEvent.type(screen.getByLabelText("이메일"), "next@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => expect(commands.login).toHaveBeenCalledTimes(1));
    await act(async () => Promise.resolve());

    expect(commands.shouldCompleteLoginInCurrentView).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("sends one command and completion for duplicate form submissions", async () => {
    let resolveLogin!: () => void;
    const commands = createCommands({
      login: vi.fn<AuthCommandPort["login"]>(
        (_credentials) =>
          new Promise<void>((resolve) => {
            resolveLogin = resolve;
          }),
      ),
    });
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    renderAuthModal(
      <AuthModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />,
      commands,
    );

    await userEvent.type(screen.getByLabelText("이메일"), "user@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    const submitButton = screen.getByRole("button", { name: "로그인" });

    fireEvent.submit(submitButton);
    fireEvent.submit(submitButton);
    expect(commands.login).toHaveBeenCalledTimes(1);

    await act(async () => resolveLogin());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
