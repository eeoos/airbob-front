import { render, screen } from "@testing-library/react";
import { PageShell } from "./PageShell";

describe("PageShell", () => {
  it("renders a labelled page region", () => {
    render(
      <PageShell title="검색 결과">
        <p>content</p>
      </PageShell>
    );

    expect(screen.getByRole("main", { name: "검색 결과" })).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
