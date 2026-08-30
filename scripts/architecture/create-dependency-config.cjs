const { testModulePattern } = require("./source-policy.cjs");
const {
  createFeatureOwnershipPathPattern,
  createFeatureSurfacePathPattern,
  discoverFeatureOwnershipScopes,
} = require("./feature-scope-policy.cjs");
const staticResourceRoots = "^src/(?:assets|styles)(?:/|$)";
const targetRoot = "^src/(?:app|screens|workflows|platform|shared)(?:/|$)";
const featureRoot = "^src/features(?:/|$)";

const legacyRouteAdapterBridges = [
  ["home", "HomeRoute", "home/HomeRoute"],
  [
    "accommodation-edit",
    "AccommodationEditRoute",
    "accommodations/edit/AccommodationEditRoute",
  ],
  ["profile", "ProfileRoute", "profile/ProfileRoute"],
  [
    "host-reservation-detail",
    "HostReservationDetailRoute",
    "reservations/HostReservationDetailRoute",
  ],
  [
    "reservation-detail",
    "ReservationDetailRoute",
    "reservations/ReservationDetailRoute",
  ],
  [
    "accommodation-confirm",
    "AccommodationConfirmRoute",
    "reservations/ReservationConfirmRoute",
  ],
  [
    "payment-success",
    "PaymentSuccessRoute",
    "reservations/PaymentSuccessRoute",
  ],
  ["payment-fail", "PaymentFailRoute", "reservations/PaymentFailRoute"],
].map(([id, adapter, target]) => ({
  adapterPath: `^src/app/router/routes/${adapter}[.][tj]sx?$`,
  id,
  targetPath: `^src/features/${target}[.][tj]sx?$`,
}));

const legacyRouteAdapterPaths = legacyRouteAdapterBridges.map(
  ({ adapterPath }) => adapterPath,
);

const scopeRuleId = (scope) => scope.replaceAll("/", "-");

const createFeatureOwnershipScopes = (projectRoot) => {
  const ownershipScopes = discoverFeatureOwnershipScopes(projectRoot);

  return ownershipScopes.map((scope) => ({
    name: scope,
    ownPath: createFeatureOwnershipPathPattern(scope, ownershipScopes),
    ruleId: scopeRuleId(scope),
  }));
};

const createDependencyConfig = ({ projectRoot, migratedFeatures }) => {
  if (!Array.isArray(migratedFeatures)) {
    throw new TypeError(
      "createDependencyConfig requires the explicit migratedFeatures registry.",
    );
  }

  const featureScopes = createFeatureOwnershipScopes(projectRoot);
  const featureScopeNames = featureScopes.map(({ name }) => name);
  const featureSurface = createFeatureSurfacePathPattern(
    featureScopeNames,
    "(?:appShell|publicCache)[.]ts$",
  );
  const featurePublicPortSurface = createFeatureSurfacePathPattern(
    featureScopeNames,
    "(?:(?:api|ports)(?:/|$)|public[.][tj]sx?$)",
  );
  const appFeaturePublicSurface = createFeatureSurfacePathPattern(
    featureScopeNames,
    "(?:(?:ui|ports)(?:/|$)|public[.]tsx?$)",
  );
  const featureUiModulePaths = featureScopeNames.flatMap((scope) => [
    createFeatureSurfacePathPattern([scope], "(?:components|ui)(?:/|$)"),
    createFeatureSurfacePathPattern([scope], "public[.][tj]sx?$"),
    createFeatureSurfacePathPattern(
      [scope],
      "[^/]*(?:Route|Panel)[.][tj]sx?$",
    ),
  ]);
  const uiModulePaths = [
    "^src/components(?:/|$)",
    "^src/layouts(?:/|$)",
    "^src/shared/ui(?:/|$)",
    ...featureUiModulePaths,
  ];
  const crossFeatureRules = featureScopes.map(({ ownPath, ruleId }) => ({
    name: `feature-${ruleId}-uses-public-cross-feature-surfaces`,
    severity: "error",
    comment:
      "Legacy feature peers may cross only through the named appShell/publicCache compatibility surfaces. " +
      "Migrated slices remove these edges instead of adding new exceptions.",
    from: { path: ownPath },
    to: {
      path: featureRoot,
      pathNot: [ownPath, featureSurface],
    },
  }));
  const migratedFeaturePaths = migratedFeatures.map((name) =>
    createFeatureOwnershipPathPattern(name, featureScopeNames),
  );
  const strictModuleRoots = [targetRoot, ...migratedFeaturePaths];
  const migratedFeatureRules = migratedFeatures.flatMap((name) => {
    const ownPath = createFeatureOwnershipPathPattern(
      name,
      featureScopeNames,
    );
    const ruleId = scopeRuleId(name);

    return [
      {
        name: `migrated-feature-${ruleId}-has-no-peer-imports`,
        severity: "error",
        from: { path: ownPath },
        to: {
          path: featureRoot,
          pathNot: ownPath,
        },
      },
      {
        name: `migrated-feature-${ruleId}-uses-target-layers`,
        severity: "error",
        from: { path: ownPath },
        to: {
          path: "^src(?:/|$)",
          pathNot: [
            ownPath,
            "^src/platform(?:/|$)",
            "^src/shared(?:/|$)",
            staticResourceRoots,
          ],
        },
      },
    ];
  });

  return {
    forbidden: [
      {
        name: "no-unresolvable",
        severity: "error",
        from: {},
        to: { couldNotResolve: true },
      },
      {
        name: "production-does-not-import-tests",
        severity: "error",
        from: {
          path: "^src(?:/|$)",
          pathNot: testModulePattern,
        },
        to: { path: testModulePattern },
      },
      {
        name: "production-does-not-import-dev-dependencies",
        severity: "error",
        from: {
          path: "^src(?:/|$)",
          pathNot: testModulePattern,
        },
        to: {
          dependencyTypes: ["npm-dev"],
          dependencyTypesNot: ["type-only"],
          pathNot: "^node_modules/@types(?:/|$)",
        },
      },
      {
        name: "target-has-no-module-cycles",
        severity: "error",
        scope: "module",
        from: { path: strictModuleRoots },
        to: { circular: true },
      },
      {
        name: "target-has-no-folder-cycles",
        severity: "error",
        scope: "folder",
        from: { path: strictModuleRoots },
        to: { circular: true },
      },
      {
        name: "legacy-cycle-debt",
        severity: "warn",
        scope: "module",
        from: { pathNot: strictModuleRoots },
        to: { circular: true },
      },
      {
        name: "legacy-cross-feature-debt",
        severity: "warn",
        from: {
          path: "^src/features/([^/]+)(?:/|$)",
          pathNot: testModulePattern,
        },
        to: {
          path: featureRoot,
          pathNot: "^src/features/$1(?:/|$)",
        },
      },
      {
        name: "app-imports-only-target-layers",
        severity: "error",
        from: { path: "^src/app(?:/|$)" },
        to: {
          path: "^src(?:/|$)",
          pathNot: [
            "^src/app(?:/|$)",
            "^src/screens(?:/|$)",
            "^src/workflows(?:/|$)",
            featureRoot,
            "^src/platform(?:/|$)",
            "^src/shared(?:/|$)",
            staticResourceRoots,
          ],
        },
      },
      {
        name: "app-uses-feature-public-surfaces",
        severity: "error",
        comment:
          "App composition may consume a feature only through ui/, ports/, or the public.ts(x) at its ownership-scope root.",
        from: {
          path: "^src/app(?:/|$)",
          pathNot: legacyRouteAdapterPaths,
        },
        to: {
          path: featureRoot,
          pathNot: appFeaturePublicSurface,
        },
      },
      ...legacyRouteAdapterBridges.map(
        ({ adapterPath, id, targetPath }) => ({
          name: `app-route-adapter-${id}-uses-only-assigned-legacy-route`,
          severity: "error",
          comment:
            "U6 compatibility adapters may reach exactly one legacy route container. " +
            "Each bridge is removed when its feature slice moves to a screen/controller.",
          from: { path: adapterPath },
          to: {
            path: featureRoot,
            pathNot: targetPath,
          },
        }),
      ),
      {
        name: "shared-is-domain-free",
        severity: "error",
        from: { path: "^src/shared(?:/|$)" },
        to: {
          path: "^src(?:/|$)",
          pathNot: ["^src/shared(?:/|$)", staticResourceRoots],
        },
      },
      {
        name: "platform-imports-only-shared",
        severity: "error",
        from: { path: "^src/platform(?:/|$)" },
        to: {
          path: "^src(?:/|$)",
          pathNot: [
            "^src/platform(?:/|$)",
            "^src/shared(?:/|$)",
            staticResourceRoots,
          ],
        },
      },
      {
        name: "workflows-use-only-allowed-layers",
        severity: "error",
        from: { path: "^src/workflows(?:/|$)" },
        to: {
          path: "^src(?:/|$)",
          pathNot: [
            "^src/workflows(?:/|$)",
            featureRoot,
            "^src/platform(?:/|$)",
            "^src/shared(?:/|$)",
            staticResourceRoots,
          ],
        },
      },
      {
        name: "workflows-have-no-peer-imports",
        severity: "error",
        from: { path: "^src/workflows/([^/]+)(?:/|$)" },
        to: {
          path: "^src/workflows(?:/|$)",
          pathNot: "^src/workflows/$1(?:/|$)",
        },
      },
      {
        name: "workflows-use-feature-public-ports",
        severity: "error",
        from: { path: "^src/workflows(?:/|$)" },
        to: {
          path: featureRoot,
          pathNot: featurePublicPortSurface,
        },
      },
      {
        name: "screens-use-only-allowed-layers",
        severity: "error",
        from: { path: "^src/screens(?:/|$)" },
        to: {
          path: "^src(?:/|$)",
          pathNot: [
            "^src/screens(?:/|$)",
            "^src/workflows(?:/|$)",
            featureRoot,
            "^src/shared(?:/|$)",
            staticResourceRoots,
          ],
        },
      },
      {
        name: "screens-have-no-peer-imports",
        severity: "error",
        from: { path: "^src/screens/([^/]+)(?:/|$)" },
        to: {
          path: "^src/screens(?:/|$)",
          pathNot: "^src/screens/$1(?:/|$)",
        },
      },
      ...crossFeatureRules,
      ...migratedFeatureRules,
      {
        name: "routes-compose-features-only-in-route-config",
        severity: "error",
        from: { path: "^src/routes(?:/|$)" },
        to: { path: featureRoot },
      },
      {
        name: "layouts-use-feature-public-surfaces",
        comment:
          "Layouts may consume feature UI and command ports through narrow ownership-scope public surfaces only.",
        severity: "error",
        from: { path: "^src/layouts(?:/|$)" },
        to: {
          path: featureRoot,
          pathNot: appFeaturePublicSurface,
        },
      },
      {
        name: "features-do-not-import-removed-pages",
        severity: "error",
        from: { path: featureRoot },
        to: { path: "^src/pages(?:/|$)" },
      },
      {
        name: "ui-does-not-import-global-api",
        severity: "error",
        from: { path: uiModulePaths },
        to: { path: "^src/api(?:/|$)" },
      },
      {
        name: "ui-does-not-import-wire-dtos",
        severity: "error",
        from: { path: uiModulePaths },
        to: { path: "^src/types(?:/|$)" },
      },
    ],
    options: {
      doNotFollow: {
        path: [
          "node_modules",
          testModulePattern,
          "[.](?:css|png|jpe?g|gif|svg|webp)$",
        ],
      },
      exclude: {
        path: "(?:^|/)(?:build|coverage|test-results)(?:/|$)",
      },
      moduleSystems: ["cjs", "es6"],
      tsConfig: { fileName: "tsconfig.json" },
      tsPreCompilationDeps: true,
      skipAnalysisNotInRules: true,
      enhancedResolveOptions: {
        exportsFields: ["exports"],
        conditionNames: ["browser", "import", "require", "default"],
        mainFields: ["browser", "module", "main", "types", "typings"],
        aliasFields: ["browser"],
      },
      progress: { type: "none" },
    },
  };
};

module.exports = {
  createDependencyConfig,
  discoverFeatureOwnershipScopes,
};
