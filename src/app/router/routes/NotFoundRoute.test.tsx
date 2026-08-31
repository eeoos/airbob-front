import { render, screen } from "@testing-library/react";
import type { NotFoundScreenProps } from "../../../screens/not-found/public";
import { NotFoundRoute } from "./NotFoundRoute";

const mockNotFoundScreen = vi.fn();

vi.mock("../../../screens/not-found/public", () => ({
  NotFoundScreen: (props: NotFoundScreenProps) => {
    mockNotFoundScreen(props);
    return <div data-testid="not-found-screen" />;
  },
}));

describe("NotFoundRoute", () => {
  it("maps the existing not-found copy into screen props", () => {
    render(<NotFoundRoute />);

    expect(screen.getByTestId("not-found-screen")).toBeInTheDocument();
    expect(mockNotFoundScreen.mock.calls.at(0)?.at(0)).toEqual({
      title: "404 Not Found",
    });
  });
});
