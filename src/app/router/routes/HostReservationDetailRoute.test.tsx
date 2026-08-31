import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { SessionSubject } from "../../../platform/session/sessionScope";
import { HostReservationDetailRoute } from "./HostReservationDetailRoute";

const scope = {
  subject: "subject:host-detail" as SessionSubject,
  epoch: 8,
};
const capturedProps: Record<string, unknown> = {};

vi.mock("../../session/useSession", () => ({
  useSession: () => ({
    captureAuthenticatedSession: () => scope,
    isCurrentSession: (candidate: unknown) => candidate === scope,
  }),
}));

vi.mock("../../../screens/reservation-detail/public", () => ({
  ReservationDetailController: (
    props: {
      navigation: { openAccommodation(id: number): void };
    } & Record<string, unknown>,
  ) => {
    Object.assign(capturedProps, props);
    return (
      <button
        type="button"
        onClick={() => props.navigation.openAccommodation(7)}
      >
        숙소 열기
      </button>
    );
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

const renderRoute = (initialEntry: string, path: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path={path} element={<HostReservationDetailRoute />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

describe("HostReservationDetailRoute", () => {
  beforeEach(() => {
    Object.keys(capturedProps).forEach((key) => delete capturedProps[key]);
  });

  it("owns the host detail scope and typed navigation", async () => {
    renderRoute(
      "/profile/host/reservations/host-reservation-1",
      "/profile/host/reservations/:reservationUid",
    );

    expect(capturedProps).toMatchObject({
      reservationUid: "host-reservation-1",
      scope,
      variant: "host",
    });

    await userEvent.click(screen.getByRole("button", { name: "숙소 열기" }));
    expect(screen.getByRole("status")).toHaveTextContent("/accommodations/7");
  });

  it("replaces a malformed route without a uid with profile", async () => {
    renderRoute("/host-reservation", "/host-reservation");

    expect(await screen.findByRole("status")).toHaveTextContent("/profile");
    expect(capturedProps.variant).toBeUndefined();
  });
});
