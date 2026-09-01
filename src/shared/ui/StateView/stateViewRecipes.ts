import type { HTMLAttributes } from "react";

type StateViewRecipeKind =
  "empty" | "loading" | "retryable-error" | "terminal-error";

type StateViewRecipe = Pick<
  HTMLAttributes<HTMLElement>,
  "aria-busy" | "aria-live" | "role"
> & {
  readonly "data-state-kind": StateViewRecipeKind;
};

/**
 * Accessibility-only recipes. Visual layout remains owned by each surface or
 * by StateView, so this does not grow into a universal state component.
 */
export const stateViewRecipes = {
  empty: {
    "aria-live": "polite",
    "data-state-kind": "empty",
    role: "status",
  },
  loading: {
    "aria-busy": true,
    "aria-live": "polite",
    "data-state-kind": "loading",
    role: "status",
  },
  retryableError: {
    "aria-live": "assertive",
    "data-state-kind": "retryable-error",
    role: "alert",
  },
  terminalError: {
    "aria-live": "assertive",
    "data-state-kind": "terminal-error",
    role: "alert",
  },
} as const satisfies Record<
  "empty" | "loading" | "retryableError" | "terminalError",
  StateViewRecipe
>;
