import { readFileSync } from "fs";
import { join } from "path";
import { routeDefinitions } from "./definitions";

const expectedRouteDefinitions = [
  { id: "home", path: "/", auth: "public", shell: "browse", header: "default" },
  { id: "search", path: "/search", auth: "public", shell: "browse", header: "search" },
  {
    id: "accommodation-detail",
    path: "/accommodations/:id",
    auth: "public",
    shell: "browse",
    header: "default",
  },
  {
    id: "accommodation-confirm",
    path: "/accommodations/:id/confirm",
    auth: "authenticated",
    shell: "transaction",
    header: "default",
  },
  {
    id: "accommodation-edit",
    path: "/accommodations/:id/edit",
    auth: "authenticated",
    shell: "editor",
    header: "default",
  },
  { id: "wishlist", path: "/wishlist", auth: "authenticated", shell: "browse", header: "default" },
  { id: "profile", path: "/profile", auth: "authenticated", shell: "browse", header: "default" },
  {
    id: "host-reservation-detail",
    path: "/profile/host/reservations/:reservationUid",
    auth: "authenticated",
    shell: "transaction",
    header: "default",
  },
  {
    id: "reservation-detail",
    path: "/reservations/:reservationUid",
    auth: "authenticated",
    shell: "transaction",
    header: "default",
  },
  {
    id: "reservation-review",
    path: "/reservations/:reservationUid/review",
    auth: "authenticated",
    shell: "form",
    header: "default",
  },
  {
    id: "payment-success",
    path: "/reservations/:reservationUid/success",
    auth: "authenticated",
    shell: "transaction",
    header: "default",
  },
  {
    id: "payment-fail",
    path: "/reservations/:reservationUid/fail",
    auth: "authenticated",
    shell: "transaction",
    header: "default",
  },
  { id: "login", path: "/login", auth: "public", shell: "form", header: "hidden" },
  { id: "signup", path: "/signup", auth: "public", shell: "form", header: "hidden" },
  { id: "not-found", path: "*", auth: "public", shell: "bare", header: "hidden" },
] as const;

describe("app route definitions", () => {
  it("defines every route id exactly once", () => {
    expect(routeDefinitions).toHaveLength(15);
    expect(routeDefinitions.map(({ id }) => id)).toEqual(
      expectedRouteDefinitions.map(({ id }) => id),
    );
    expect(new Set(routeDefinitions.map(({ id }) => id)).size).toBe(15);
  });

  it("locks all route path, auth, shell, and header policies", () => {
    expect(routeDefinitions).toEqual(expectedRouteDefinitions);
    expect(routeDefinitions.at(-1)?.id).toBe("not-found");
    expect(new Set(routeDefinitions.map(({ path }) => path)).size).toBe(15);
  });

  it("keeps definitions component-free", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/router/definitions.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/react(?:-router)?/i);
    expect(source).not.toMatch(/features\//);
    expect(source).not.toMatch(/screens\//);
    expect(source).not.toMatch(/window|document|location\./);
  });
});
