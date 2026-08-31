import { createTestQueryClient } from "./createTestQueryClient";

describe("createTestQueryClient", () => {
  it("creates an isolated deterministic client for every test", () => {
    const first = createTestQueryClient();
    const second = createTestQueryClient();

    expect(first).not.toBe(second);
    expect(first.getDefaultOptions()).toMatchObject({
      queries: {
        retry: false,
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    });
  });

  it("accepts explicit per-test overrides without losing deterministic defaults", () => {
    const client = createTestQueryClient({
      defaultOptions: {
        queries: { retry: 2, staleTime: 50 },
        mutations: { retry: 1 },
      },
    });

    expect(client.getDefaultOptions()).toMatchObject({
      queries: {
        retry: 2,
        staleTime: 50,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: 1 },
    });
  });
});
