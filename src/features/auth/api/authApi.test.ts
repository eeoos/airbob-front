import {
  requestApiData,
  requestApiDataNullable,
} from "../../../platform/http/request";
import { sessionOwnedAuthEventPolicy } from "../../../platform/http/authEventPolicy";
import { authApi } from "./authApi";

vi.mock("../../../platform/http/request", () => ({
  requestApiData: vi.fn(),
  requestApiDataNullable: vi.fn(),
}));

const mockRequestApiData = vi.mocked(requestApiData);
const mockRequestApiDataNullable = vi.mocked(requestApiDataNullable);

describe("feature auth API contract", () => {
  beforeEach(() => {
    mockRequestApiData.mockReset();
    mockRequestApiDataNullable.mockReset();
    mockRequestApiDataNullable.mockResolvedValue(null);
  });

  it("preserves the session-owned login request contract", async () => {
    const controller = new AbortController();
    const credentials = {
      email: "guest@example.com",
      password: "password123",
    };

    await authApi.login(credentials, controller.signal);

    expect(mockRequestApiDataNullable).toHaveBeenCalledWith({
      method: "POST",
      path: "/auth/login",
      body: credentials,
      signal: controller.signal,
      authEventPolicy: sessionOwnedAuthEventPolicy,
    });
  });

  it("preserves the signup request contract", async () => {
    const request = {
      nickname: "airbob",
      email: "guest@example.com",
      password: "password123",
    };

    await authApi.signup(request);

    expect(mockRequestApiDataNullable).toHaveBeenCalledWith({
      method: "POST",
      path: "/members",
      body: request,
    });
  });

  it("preserves the session-owned logout request contract", async () => {
    const controller = new AbortController();

    await authApi.logout(controller.signal);

    expect(mockRequestApiDataNullable).toHaveBeenCalledWith({
      method: "POST",
      path: "/auth/logout",
      signal: controller.signal,
      authEventPolicy: sessionOwnedAuthEventPolicy,
    });
  });

  it("maps the viewer wire response into the feature model", async () => {
    const controller = new AbortController();
    mockRequestApiData.mockResolvedValue({
      id: 41,
      email: "guest@example.com",
      nickname: "Guest",
      thumbnail_image_url: "/images/guest.jpg",
    });

    await expect(authApi.getViewer(controller.signal)).resolves.toEqual({
      id: 41,
      email: "guest@example.com",
      nickname: "Guest",
      thumbnailImageUrl: "/images/guest.jpg",
    });
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "GET",
      path: "/auth/me",
      signal: controller.signal,
      authEventPolicy: sessionOwnedAuthEventPolicy,
    });
  });
});
