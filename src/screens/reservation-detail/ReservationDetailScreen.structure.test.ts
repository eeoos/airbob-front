import { readFileSync } from "node:fs";
import { join } from "node:path";

const readSource = (fileName: string) =>
  readFileSync(join(__dirname, fileName), "utf8");

describe("reservation detail screen boundaries", () => {
  it("keeps the public screen as a thin variant adapter", () => {
    const source = readSource("ReservationDetailScreen.tsx");

    expect(source.split("\n").length).toBeLessThanOrEqual(40);
    expect(source).toContain("GuestReservationDetailScreen");
    expect(source).toContain("HostReservationDetailScreen");
    expect(source).toContain('props.variant === "guest"');
    expect(source).not.toMatch(
      /module[.]css|guestStyles|hostStyles|PageContainer|StatusBadge|ToastHost|<img\b/,
    );
  });

  it("keeps guest and host render trees physically independent", () => {
    const guestSource = readSource("GuestReservationDetailScreen.tsx");
    const hostSource = readSource("HostReservationDetailScreen.tsx");

    expect(guestSource).toContain("GuestReservationDetailScreen.module.css");
    expect(guestSource).toContain("GuestReservationDetailScreenProps");
    expect(guestSource).not.toMatch(
      /hostStyles|HostReservationDetailScreenProps/,
    );

    expect(hostSource).toContain("HostReservationDetailScreen.module.css");
    expect(hostSource).toContain("HostReservationDetailScreenProps");
    expect(hostSource).not.toMatch(
      /guestStyles|GuestReservationDetailScreenProps/,
    );
  });

  it("keeps the shared view contract free of rendering and React state ownership", () => {
    const source = readSource("reservationDetailViewContract.ts");

    expect(source).toContain("ReservationDetailScreenProps");
    expect(source).toContain('readonly variant: "guest"');
    expect(source).toContain('readonly variant: "host"');
    expect(source).not.toMatch(
      /from ["']react["']|React[.]|useState|Dispatch|SetStateAction|module[.]css|className=/,
    );
  });
});
