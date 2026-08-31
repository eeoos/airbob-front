import {
  AccommodationActionModal,
  type AccommodationActionModalProps,
} from "../../features/accommodations/components/AccommodationActionModal/AccommodationActionModal";
import {
  HostListingsPanel,
  type HostListingsPanelProps,
} from "../../features/profile/HostListingsPanel";
import {
  ProfileShell,
  type GuestProfileTab,
  type HostProfileSection,
  type ProfileMode,
} from "../../features/profile/components/ProfileShell";
import {
  GuestTripsPanel,
  type GuestTripsPanelProps,
} from "../../features/reservations/GuestTripsPanel";
import {
  HostReservationsPanel,
  type HostReservationsPanelProps,
} from "../../features/reservations/HostReservationsPanel";

interface ProfileScreenBaseProps {
  readonly onModeChange: (mode: ProfileMode) => void;
}

export type ProfileScreenProps = ProfileScreenBaseProps &
  (
    | {
        readonly variant: "guest";
        readonly activeTab: GuestProfileTab;
        readonly guestTrips: GuestTripsPanelProps;
        readonly onTabChange: (tab: GuestProfileTab) => void;
      }
    | {
        readonly variant: "host-listings";
        readonly accommodationAction: AccommodationActionModalProps;
        readonly hostListings: HostListingsPanelProps;
        readonly onSectionChange: (section: HostProfileSection) => void;
      }
    | {
        readonly variant: "host-reservations";
        readonly hostReservations: HostReservationsPanelProps;
        readonly onSectionChange: (section: HostProfileSection) => void;
      }
  );

export function ProfileScreen(props: ProfileScreenProps) {
  if (props.variant === "guest") {
    return (
      <ProfileShell
        mode="guest"
        activeTab={props.activeTab}
        onModeChange={props.onModeChange}
        onTabChange={props.onTabChange}
      >
        <GuestTripsPanel {...props.guestTrips} />
      </ProfileShell>
    );
  }

  if (props.variant === "host-listings") {
    return (
      <ProfileShell
        mode="host"
        activeTab="listings"
        onModeChange={props.onModeChange}
        onTabChange={props.onSectionChange}
      >
        <HostListingsPanel {...props.hostListings} />
        <AccommodationActionModal {...props.accommodationAction} />
      </ProfileShell>
    );
  }

  return (
    <ProfileShell
      mode="host"
      activeTab="reservations"
      onModeChange={props.onModeChange}
      onTabChange={props.onSectionChange}
    >
      <HostReservationsPanel {...props.hostReservations} />
    </ProfileShell>
  );
}
