import { act, renderHook, waitFor } from "@testing-library/react";
import {
  useAuthForm,
  type AuthFormController,
} from "./authForm";
import type { AuthFormValues } from "./auth";

const validSignup = {
  nickname: "airbob",
  email: "guest@example.com",
  password: "password123",
  confirmPassword: "password123",
};

const fillForm = (
  controller: AuthFormController,
  values: AuthFormValues,
) => {
  controller.setField("nickname", values.nickname);
  controller.setField("email", values.email);
  controller.setField("password", values.password);
  controller.setField("confirmPassword", values.confirmPassword);
};

describe("useAuthForm", () => {
  it("validates confirmation before invoking the signup command", async () => {
    const signup = jest.fn();
    const { result } = renderHook(() =>
      useAuthForm({ mode: "signup", signup }),
    );

    act(() => {
      fillForm(result.current, {
        ...validSignup,
        confirmPassword: "different123",
      });
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(signup).not.toHaveBeenCalled();
    expect(result.current.error).toBe("비밀번호가 일치하지 않습니다.");
  });

  it("retains form values and maps an exact auth error after failure", async () => {
    const login = jest
      .fn()
      .mockRejectedValue(new Error("이메일 또는 비밀번호가 올바르지 않습니다."));
    const { result } = renderHook(() => useAuthForm({ mode: "login", login }));

    act(() => {
      fillForm(result.current, {
        ...validSignup,
        email: "wrong@example.com",
        password: "wrong-password",
      });
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.values.email).toBe("wrong@example.com");
    expect(result.current.values.password).toBe("wrong-password");
    expect(result.current.error).toBe(
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
  });

  it("shares one in-flight command across duplicate submissions", async () => {
    let resolveLogin!: () => void;
    const login = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const { result } = renderHook(() => useAuthForm({ mode: "login", login }));

    act(() => {
      fillForm(result.current, validSignup);
    });

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.submit();
      second = result.current.submit();
    });

    expect(first).toBe(second);
    expect(login).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(true);

    await act(async () => resolveLogin());

    await expect(first).resolves.toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("maps backend auth codes without exposing transport details", async () => {
    const login = jest.fn().mockRejectedValue({
      code: "M001",
      message: "raw backend message",
    });
    const { result } = renderHook(() => useAuthForm({ mode: "login", login }));

    act(() => fillForm(result.current, validSignup));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.error).toBe(
      "존재하지 않거나 활성 상태가 아닌 사용자입니다.",
    );
  });

  it("allows retry when a command adapter throws before returning a promise", async () => {
    const login = jest
      .fn<Promise<void>, [{ email: string; password: string }]>()
      .mockImplementationOnce(() => {
        throw new Error("동기 어댑터 실패");
      })
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuthForm({ mode: "login", login }));

    act(() => fillForm(result.current, validSignup));
    await act(async () => {
      await result.current.submit();
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(login).toHaveBeenCalledTimes(2);
  });
});
