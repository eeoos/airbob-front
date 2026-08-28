import { createAppQueryClient } from "../../query/queryClient";
import { createQueryClient } from "./createQueryClient";

describe("createQueryClient", () => {
  it("preserves the production query and mutation defaults", () => {
    const defaults = createQueryClient().getDefaultOptions();

    expect(defaults.queries).toMatchObject({
      retry: 1,
      refetchOnWindowFocus: false,
    });
    expect(defaults.mutations).toMatchObject({ retry: false });
  });

  it("allows a test harness to override defaults without dropping production safeguards", () => {
    const defaults = createQueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
      },
    }).getDefaultOptions();

    expect(defaults.queries).toMatchObject({
      retry: false,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    });
    expect(defaults.mutations).toMatchObject({ retry: false });
  });

  it("connects the legacy production factory to the platform implementation", () => {
    const defaults = createAppQueryClient().getDefaultOptions();

    expect(defaults.queries).toMatchObject({
      retry: 1,
      refetchOnWindowFocus: false,
    });
    expect(defaults.mutations).toMatchObject({ retry: false });
  });
});
