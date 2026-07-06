import { render, screen } from "@testing-library/react";
import { HomeRoute } from "./HomeRoute";

describe("HomeRoute", () => {
  it("renders the hero content from the home view model", () => {
    render(<HomeRoute />);

    expect(
      screen.getByRole("heading", {
        name: "Airbob에서 특별한 숙소를 찾아보세요",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("전 세계 수백만 개의 숙소 중에서 선택하세요"),
    ).toBeInTheDocument();
  });
});
