// src/utils/authEvents.ts

/**
 * Temporary legacy facade. The platform session channel is the single owner;
 * HTTP compatibility code keeps this import path until its U22 cleanup.
 */
export {
  onAuthError,
  triggerAuthError,
  type AuthErrorEvent,
} from "../platform/session/authEvents";
