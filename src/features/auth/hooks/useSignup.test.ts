import { act, renderHook, waitFor } from "@testing-library/react";
import { authApi } from "../../../api";
import { useSignup } from "./useSignup";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../../api", () => ({
  authApi: {
    signup: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

const validSignup = {
  nickname: "airbob",
  email: "user@example.com",
  password: "password123",
  confirmPassword: "password123",
};

describe("useSignup", () => {
  beforeEach(() => {
    mockClearError.mockReset();
    mockHandleError.mockReset();
    jest.mocked(authApi.signup).mockReset();
  });

  it("validates password confirmation before calling the signup API", async () => {
    const { result } = renderHook(() => useSignup());

    let submitted = true;
    await act(async () => {
      submitted = await result.current.signup({
        ...validSignup,
        confirmPassword: "different123",
      });
    });

    expect(submitted).toBe(false);
    expect(authApi.signup).not.toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalledWith(
      new Error("비밀번호가 일치하지 않습니다.")
    );
  });

  it("validates password length before calling the signup API", async () => {
    const { result } = renderHook(() => useSignup());

    let submitted = true;
    await act(async () => {
      submitted = await result.current.signup({
        ...validSignup,
        password: "short",
        confirmPassword: "short",
      });
    });

    expect(submitted).toBe(false);
    expect(authApi.signup).not.toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalledWith(
      new Error("비밀번호는 8자 이상 20자 이하여야 합니다.")
    );
  });

  it("submits valid signup data and reports success", async () => {
    jest.mocked(authApi.signup).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSignup());

    let submitted = false;
    await act(async () => {
      submitted = await result.current.signup(validSignup);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(submitted).toBe(true);
    expect(authApi.signup).toHaveBeenCalledWith({
      nickname: "airbob",
      email: "user@example.com",
      password: "password123",
    });
  });
});
