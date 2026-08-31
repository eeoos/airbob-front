import { ROUTE_PATHS } from "./paths";

const decodeStaticRouteSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment).toLowerCase();
  } catch {
    return segment.toLowerCase();
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isIdentityOwnedTransactionPath = (pathname: string): boolean => {
  const segments = pathname.replace(/\/+$/, "").split("/");
  const [root, namespaceSegment, resourceId, terminalSegment] = segments;
  if (
    segments.length !== 4 ||
    root !== "" ||
    namespaceSegment === undefined ||
    !resourceId ||
    terminalSegment === undefined
  ) {
    return false;
  }

  const namespace = decodeStaticRouteSegment(namespaceSegment);
  const terminal = decodeStaticRouteSegment(terminalSegment);

  return (
    (namespace === "accommodations" && terminal === "confirm") ||
    (namespace === "reservations" &&
      (terminal === "success" || terminal === "fail"))
  );
};

/**
 * Checkout handoff and payment callback tuples belong to the identity that
 * opened them. A session boundary must not remount those browser inputs under
 * a different cookie, so the current entry is synchronously replaced before
 * the keyed application subtree mounts again.
 */
export const clearIdentityOwnedTransactionRoute = (): boolean => {
  if (
    typeof window === "undefined" ||
    !isIdentityOwnedTransactionPath(window.location.pathname)
  ) {
    return false;
  }

  try {
    const currentState = window.history.state;
    const nextState = isRecord(currentState)
      ? { ...currentState, usr: null }
      : { usr: null };
    window.history.replaceState(nextState, "", ROUTE_PATHS.home);
    return true;
  } catch {
    return false;
  }
};
