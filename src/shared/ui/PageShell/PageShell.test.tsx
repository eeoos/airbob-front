import { render, screen } from "@testing-library/react";
import { PageShell, type PageShellProps } from "./PageShell";

const pageShellHasRoleProp: "role" extends keyof PageShellProps ? true : false =
  false;

describe("PageShell", () => {
  it("renders labelled page structure without claiming the app main landmark", () => {
    render(
      <PageShell title="검색 결과">
        <p>content</p>
      </PageShell>
    );

    expect(
      screen.getByRole("region", { name: "검색 결과" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(pageShellHasRoleProp).toBe(false);
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("keeps its region role when untyped input attempts to inject main", () => {
    const unsafeProps = { role: "main" } as unknown as PageShellProps;

    render(<PageShell {...unsafeProps} title="검색 결과" />);

    expect(
      screen.getByRole("region", { name: "검색 결과" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("keeps the title as the accessible page label", () => {
    render(<PageShell title="검색 결과" aria-label="override" />);

    expect(
      screen.getByRole("region", { name: "검색 결과" }),
    ).toBeInTheDocument();
  });
});
