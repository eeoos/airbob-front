import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ROUTE_PATHS } from "../../../routes/paths";
import { AccommodationEditRoute } from "./AccommodationEditRoute";
import { useAccommodationEditController } from "./hooks/useAccommodationEditController";

jest.mock("./components/AccommodationEditScreen", () => ({
  AccommodationEditScreen: () => null,
}));

jest.mock("./hooks/useAccommodationEditController", () => ({
  useAccommodationEditController: jest.fn(),
}));

const mockUseAccommodationEditController = jest.mocked(
  useAccommodationEditController,
);

const renderEditRoute = (
  entry:
    | string
    | {
        pathname: string;
        search?: string;
        state?: unknown;
      },
) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path={ROUTE_PATHS.accommodationEdit}
          element={<AccommodationEditRoute />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe("AccommodationEditRoute navigation state", () => {
  beforeEach(() => {
    mockUseAccommodationEditController.mockReset();
    mockUseAccommodationEditController.mockReturnValue({
      state: {},
      actions: {},
    } as ReturnType<typeof useAccommodationEditController>);
  });

  it("does not treat a legacy mode=create query as creation provenance", () => {
    renderEditRoute("/accommodations/42/edit?mode=create");

    expect(mockUseAccommodationEditController).toHaveBeenCalledWith(
      expect.objectContaining({
        accommodationId: "42",
        isNewDraft: false,
      }),
    );
  });

  it("recognizes a matching draft-created navigation state", () => {
    renderEditRoute({
      pathname: "/accommodations/42/edit",
      state: {
        accommodationEdit: {
          accommodationId: "42",
          source: "created-draft",
        },
      },
    });

    expect(mockUseAccommodationEditController).toHaveBeenCalledWith(
      expect.objectContaining({
        accommodationId: "42",
        isNewDraft: true,
      }),
    );
  });

  it("rejects draft-created navigation state for a different accommodation", () => {
    renderEditRoute({
      pathname: "/accommodations/42/edit",
      state: {
        accommodationEdit: {
          accommodationId: "41",
          source: "created-draft",
        },
      },
    });

    expect(mockUseAccommodationEditController).toHaveBeenCalledWith(
      expect.objectContaining({
        accommodationId: "42",
        isNewDraft: false,
      }),
    );
  });
});
