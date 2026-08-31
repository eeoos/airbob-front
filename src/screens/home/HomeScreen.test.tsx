import { render, screen } from "@testing-library/react";
import { HomeScreen } from "./HomeScreen";

describe("HomeScreen", () => {
  it("renders only the hero content supplied by props", () => {
    render(<HomeScreen title="숙소 제목" subtitle="숙소 설명" />);

    expect(
      screen.getByRole("heading", { name: "숙소 제목" }),
    ).toBeInTheDocument();
    expect(screen.getByText("숙소 설명")).toBeInTheDocument();
  });
});
