import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MainLayout } from "./MainLayout";

jest.mock(
  "react-router",
  () => {
    const { TextDecoder, TextEncoder } = jest.requireActual("util");
    Object.assign(globalThis, { TextDecoder, TextEncoder });

    return jest.requireActual("../../node_modules/react-router/dist/development/index.js");
  },
  { virtual: true }
);

jest.mock(
  "react-router/dom",
  () =>
    jest.requireActual(
      "../../node_modules/react-router/dist/development/dom-export.js"
    ),
  { virtual: true }
);

jest.mock(
  "react-router-dom",
  () => jest.requireActual("../../node_modules/react-router-dom/dist/index.js"),
  { virtual: true }
);

jest.mock("./AppHeader", () => ({
  Header: () => <header data-testid="header" />,
}));

describe("MainLayout", () => {
  it("renders nested route content inside its main landmark by default", () => {
    render(
      <MemoryRouter initialEntries={["/nested"]}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route
              path="/nested"
              element={<div data-testid="nested-route">Nested route</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const main = screen.getByRole("main");

    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(within(main).getByTestId("nested-route")).toBeInTheDocument();
  });

  it("renders explicit children inside its main landmark", () => {
    render(
      <MainLayout>
        <div data-testid="explicit-child">Explicit child</div>
      </MainLayout>
    );

    const main = screen.getByRole("main");

    expect(within(main).getByTestId("explicit-child")).toBeInTheDocument();
  });
});
