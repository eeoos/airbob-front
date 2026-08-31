import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createListingEditorQueryPort,
  listingEditorApi,
} from "../../../features/accommodations/listing-editor/public";
import { createAccommodationDetailQueryCacheProjection } from "../../../features/accommodations/detail/public";
import { createHostListingQueryCacheProjection } from "../../../features/profile/public";
import { resolveImageUrl } from "../../../platform/assets/imageUrl";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import { AccommodationEditController } from "../../../screens/accommodation-edit/public";
import type { ListingEditorPublicationPort } from "../../../workflows/listing-editor";
import { useSession } from "../../session/useSession";
import { isAccommodationEditDraftCreationState, routeTo } from "../paths";
import { listingEditorAddressSearch } from "./listingEditorAddressSearch";

const toAccommodationId = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
};

export function AccommodationEditRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const { id } = useParams<{ id: string }>();
  const accommodationId = toAccommodationId(id);
  const editorQuery = useMemo(
    () => createListingEditorQueryPort(queryClient, listingEditorApi),
    [queryClient],
  );
  const captureAuthenticatedSession = session.captureAuthenticatedSession;
  const isCurrentSession = session.isCurrentSession;
  const workflowSession = useMemo(
    () => ({ captureAuthenticatedSession, isCurrentSession }),
    [captureAuthenticatedSession, isCurrentSession],
  );
  const scope = captureAuthenticatedSession();

  const routeLease = useMemo(
    () => ({
      isCurrent: () =>
        browserWindowNavigation.isCurrentHistoryEntry({
          hash: location.hash,
          key: location.key,
          pathname: location.pathname,
          search: location.search,
        }),
    }),
    [location.hash, location.key, location.pathname, location.search],
  );

  const publication = useMemo<ListingEditorPublicationPort>(() => {
    const accommodationDetails =
      createAccommodationDetailQueryCacheProjection(queryClient);
    const hostListings = createHostListingQueryCacheProjection(queryClient);

    return {
      async publishEditorChanged({
        accommodationId: changedAccommodationId,
        scope: changedScope,
      }) {
        await Promise.all([
          accommodationDetails.detailRefreshRequired({
            accommodationId: changedAccommodationId,
            scope: changedScope,
          }),
          hostListings.refreshRequired({
            scope: changedScope,
          }),
        ]);
      },
    };
  }, [queryClient]);

  const navigateToHostProfile = useCallback(() => {
    navigate(routeTo.profile({ mode: "host" }));
  }, [navigate]);

  const instanceId = [
    "listing-editor",
    location.key,
    accommodationId,
    scope?.subject ?? "anonymous",
    scope?.epoch ?? session.state.epoch,
  ].join(":");

  return (
    <AccommodationEditController
      key={instanceId}
      accommodationId={accommodationId}
      addressSearch={listingEditorAddressSearch}
      api={listingEditorApi}
      instanceId={instanceId}
      isNewDraft={isAccommodationEditDraftCreationState(location.state, id)}
      onNavigateToHostProfile={navigateToHostProfile}
      publication={publication}
      query={editorQuery}
      resolveImageUrl={resolveImageUrl}
      routeLease={routeLease}
      session={workflowSession}
    />
  );
}

export default AccommodationEditRoute;
