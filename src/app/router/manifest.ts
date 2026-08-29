import type { ComponentType, LazyExoticComponent } from "react";
import {
  routeDefinitions,
  type AppRouteDefinition,
} from "./definitions";
import { lazyRoutes } from "./lazyRoutes";

export interface AppRouteManifestEntry extends AppRouteDefinition {
  component: LazyExoticComponent<
    ComponentType<Record<string, never>>
  >;
}

export const routeManifest: readonly AppRouteManifestEntry[] =
  routeDefinitions.map((definition) => ({
    ...definition,
    component: lazyRoutes[definition.id],
  }));
