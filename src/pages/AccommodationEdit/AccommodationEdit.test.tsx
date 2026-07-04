import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import AccommodationEdit from "./AccommodationEdit";

const mockNavigate = jest.fn();
const mockAccommodationEditRoute = jest.fn();
let mockParams: { id?: string } = { id: "3" };
let mockSearchParams = new URLSearchParams();

jest.mock(
  "react-router-dom",
  () => ({
    useParams: () => mockParams,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, jest.fn()],
  }),
  { virtual: true }
);

jest.mock("../../features/accommodations/edit", () => ({
  AccommodationEditRoute: ({
    accommodationId,
    isNewDraft,
    onNavigateToHostProfile,
  }: {
    accommodationId?: string;
    isNewDraft: boolean;
    onNavigateToHostProfile: () => void;
  }) => {
    mockAccommodationEditRoute({
      accommodationId,
      isNewDraft,
      onNavigateToHostProfile,
    });

    return (
      <button type="button" onClick={onNavigateToHostProfile}>
        호스트 프로필로 이동
      </button>
    );
  },
}));

describe("AccommodationEdit page adapter", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockAccommodationEditRoute.mockReset();
    mockParams = { id: "3" };
    mockSearchParams = new URLSearchParams();
  });

  it("passes route params and edit mode to the feature route container", () => {
    render(<AccommodationEdit />);

    expect(mockAccommodationEditRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        accommodationId: "3",
        isNewDraft: false,
        onNavigateToHostProfile: expect.any(Function),
      })
    );
  });

  it("passes create mode as a new draft flag", () => {
    mockParams = { id: "7" };
    mockSearchParams = new URLSearchParams("mode=create");

    render(<AccommodationEdit />);

    expect(mockAccommodationEditRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        accommodationId: "7",
        isNewDraft: true,
      })
    );
  });

  it("adapts host-profile navigation for the feature route", () => {
    render(<AccommodationEdit />);

    fireEvent.click(screen.getByRole("button", { name: "호스트 프로필로 이동" }));

    expect(mockNavigate).toHaveBeenCalledWith("/profile?mode=host");
  });
});
