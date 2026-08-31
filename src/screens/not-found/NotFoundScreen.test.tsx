import { render, screen } from "@testing-library/react";
import { NotFoundScreen } from "./NotFoundScreen";

describe("NotFoundScreen", () => {
  it("renders the title supplied by props", () => {
    render(<NotFoundScreen title="찾을 수 없는 페이지" />);

    expect(
      screen.getByRole("heading", { name: "찾을 수 없는 페이지" }),
    ).toBeInTheDocument();
  });
});
