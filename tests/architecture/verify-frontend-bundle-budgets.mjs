import assert from "node:assert/strict";
import {
  enforceFrontendBundleBudgets,
  measureFrontendBundleGraphs,
  readFrontendBundleBudgets,
  validateFrontendBundleBudgets,
} from "../../scripts/architecture/frontend-bundle-budgets.mjs";

const budgets = await readFrontendBundleBudgets();
assert.deepEqual(budgets, {
  initialJavaScriptGzipBytes: 131_400,
  lazyRouteIncrementalJavaScriptGzipBytes: 80_000,
});

const graphMeasurements = measureFrontendBundleGraphs({
  manifest: {
    "index.html": {
      file: "static/index.js",
      imports: ["_initial-shared.js"],
    },
    "_initial-shared.js": { file: "static/initial-shared.js" },
    "src/app/router/routes/SearchRoute.tsx": {
      file: "static/SearchRoute.js",
      imports: [
        "_initial-shared.js",
        "_oversized-route-shared.js",
        "_oversized-route-shared.js",
      ],
    },
    "_oversized-route-shared.js": {
      file: "static/oversized-route-shared.js",
    },
  },
  initialJavaScriptFiles: ["static/index.js"],
  lazyRouteManifestEntries: [
    {
      routeName: "SearchRoute",
      manifestKey: "src/app/router/routes/SearchRoute.tsx",
    },
  ],
  javascriptGzipBytesByFile: new Map([
    ["static/index.js", 100],
    ["static/initial-shared.js", 50],
    ["static/SearchRoute.js", 1],
    ["static/oversized-route-shared.js", 80_000],
  ]),
});
assert.deepEqual(graphMeasurements, {
  initialJavaScriptGzipBytes: 150,
  initialFiles: ["static/index.js", "static/initial-shared.js"],
  lazyRouteIncrementalJavaScriptGzipMeasurements: [
    {
      routeName: "SearchRoute",
      gzipBytes: 80_001,
      files: [
        {
          fileName: "static/oversized-route-shared.js",
          gzipBytes: 80_000,
        },
        { fileName: "static/SearchRoute.js", gzipBytes: 1 },
      ],
    },
  ],
});
assert.throws(
  () =>
    enforceFrontendBundleBudgets({
      budgets,
      initialJavaScriptGzipBytes: graphMeasurements.initialJavaScriptGzipBytes,
      lazyRouteIncrementalJavaScriptGzipMeasurements:
        graphMeasurements.lazyRouteIncrementalJavaScriptGzipMeasurements,
    }),
  /Lazy route SearchRoute exceeded its 80000-byte incremental JavaScript gzip budget: 80001 bytes/,
);

assert.deepEqual(
  enforceFrontendBundleBudgets({
    budgets,
    initialJavaScriptGzipBytes: 131_400,
    lazyRouteIncrementalJavaScriptGzipMeasurements: [
      { routeName: "SearchRoute", gzipBytes: 80_000 },
      { routeName: "HomeRoute", gzipBytes: 1 },
    ],
  }),
  {
    initialJavaScriptGzipBytes: 131_400,
    maximumLazyRouteIncrementalJavaScriptGraph: {
      routeName: "SearchRoute",
      gzipBytes: 80_000,
    },
  },
);

assert.throws(
  () =>
    enforceFrontendBundleBudgets({
      budgets,
      initialJavaScriptGzipBytes: 131_401,
      lazyRouteIncrementalJavaScriptGzipMeasurements: [
        { routeName: "SearchRoute", gzipBytes: 80_000 },
      ],
    }),
  /initial JavaScript graph exceeded its 131400-byte gzip budget: 131401 bytes/,
);
assert.throws(
  () =>
    enforceFrontendBundleBudgets({
      budgets,
      initialJavaScriptGzipBytes: 131_400,
      lazyRouteIncrementalJavaScriptGzipMeasurements: [
        { routeName: "SearchRoute", gzipBytes: 80_001 },
      ],
    }),
  /Lazy route SearchRoute exceeded its 80000-byte incremental JavaScript gzip budget: 80001 bytes/,
);
assert.throws(
  () =>
    enforceFrontendBundleBudgets({
      budgets,
      initialJavaScriptGzipBytes: 131_400,
      lazyRouteIncrementalJavaScriptGzipMeasurements: [
        { routeName: "SearchRoute", gzipBytes: 1 },
        { routeName: "SearchRoute", gzipBytes: 1 },
      ],
    }),
  /Duplicate lazy-route bundle measurement: SearchRoute/,
);
assert.throws(
  () =>
    validateFrontendBundleBudgets({
      initialJavaScriptGzipBytes: 131_400,
      lazyRouteIncrementalJavaScriptGzipBytes: 80_000,
      undocumentedEscapeHatch: 999_999,
    }),
  /must define only/,
);

process.stdout.write(
  "Frontend initial and per-lazy-route incremental graph budgets passed semantic fixtures.\n",
);
