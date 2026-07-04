import React from "react";
import { render } from "@testing-library/react";
import Profile from "./Profile";

const mockSetSearchParams = jest.fn();
let mockSearchParams = new URLSearchParams("");
const mockProfileRoute = jest.fn(() => <div data-testid="profile-route" />);

jest.mock(
  "react-router-dom",
  () => ({
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  }),
  { virtual: true },
);

jest.mock("../../features/profile", () => ({
  ProfileRoute: (props: unknown) => mockProfileRoute(props),
}));

describe("Profile route state integration", () => {
  beforeEach(() => {
    mockSetSearchParams.mockReset();
    mockProfileRoute.mockClear();
    mockSearchParams = new URLSearchParams("");
  });

  it("delegates search params to the profile feature route", () => {
    render(<Profile />);

    expect(mockProfileRoute).toHaveBeenCalledWith({
      searchParams: mockSearchParams,
      setSearchParams: mockSetSearchParams,
    });
  });
});
