import { renderHook } from "@testing-library/react";
import {
  AuthCommandProvider,
  useAuthCommands,
  type AuthCommandPort,
} from "./AuthCommandProvider";

const commands: AuthCommandPort = {
  login: jest.fn(),
  signup: jest.fn(),
  shouldCompleteLoginInCurrentView: jest.fn(() => true),
};

describe("AuthCommandProvider", () => {
  it("exposes injected commands without owning identity state", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthCommandProvider commands={commands}>{children}</AuthCommandProvider>
    );

    const { result } = renderHook(() => useAuthCommands(), { wrapper });

    expect(result.current).toBe(commands);
  });

  it("fails explicitly outside the composition boundary", () => {
    expect(() => renderHook(() => useAuthCommands())).toThrow(
      "useAuthCommands must be used within an AuthCommandProvider",
    );
  });
});
