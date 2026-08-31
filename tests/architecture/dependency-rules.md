# Frontend Architecture Ratchets

> Refactor starting baseline: `cfdb1e4`; read-only backend contract target: `b2ec09a`.

This document is the executable-policy companion to the canonical frontend
architecture. It records which tool owns each static rule, how a migrated slice
becomes strict without a suppression wall, and which global checks no longer
permit historical dependency debt.

## Single rule owners

| Concern                                                                               | Owner                                                   | Current blocking scope                                                                           | Legacy signal                                                                                                                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import direction, resolvability, production-to-test/dev edges, module/folder cycles   | dependency-cruiser                                      | `src/app`, `screens`, `workflows`, `platform`, `shared`, plus features registered as migrated    | Legacy cycles remain warnings. Every feature-to-peer production import is an error.                                                                                                   |
| Production reachability and export surface                                            | Knip strict production scan                             | Global production project                                                                        | Zero unused files, value/type exports, and duplicate exports; no target preprocessor, per-file ignore, artificial entry, or test-only production consumer.                            |
| Runtime/development dependency classification, unlisted imports, and package binaries | Knip full-graph plus strict-production scans            | Global                                                                                           | No baseline, Git delta, package ignore, or dependency suppression is permitted.                                                                                                       |
| CSS syntax and design references                                                      | Stylelint                                               | Target/migrated CSS plus the already-clean shell/modal files named in config                     | Legacy design/syntax debt is warning-only; breakpoint and suppression invariants remain global errors.                                                                                |
| CSS interaction/token invariants not expressible by the pinned Stylelint line         | Focused Vitest contracts using the central style policy | Target/migrated CSS plus the named high-risk pre-redesign set                                    | No duplicated raw-color, `!important`, or import scanner remains.                                                                                                                     |
| Local TypeScript/JavaScript feedback                                                  | ESLint                                                  | Existing strict source gate and architecture-tool scripts, including CRA-resolved `.mjs` modules | None for files in strict scope.                                                                                                                                                       |
| Runtime behavior                                                                      | Vitest and deterministic Playwright                     | Current behavior and migrated flows                                                              | Target behavior is never counted through skips.                                                                                                                                       |
| Mechanical formatting                                                                 | Prettier 3.9 plus EditorConfig                          | Active source, tests, configuration, and compact current documentation                           | Wide hand-maintained architecture registries, generated artifacts, npm's lockfile, local tool state, binary assets, archived docs, and historical plans retain their existing owners. |

TypeScript 5.9 separately owns browser application, Vitest, Node tooling, and
Playwright environments. It proves local type contracts; it does not duplicate
dependency direction, reachability, or CSS policy.

## ESLint owner

ESLint 9 is the sole JavaScript and TypeScript lint owner and uses one native
flat configuration. Browser source, Vitest, Playwright, Node ESM tooling, and
Node CommonJS configuration receive explicit, non-overlapping globals. The
configuration does not inherit Create React App, Jest, or hidden environment
defaults.

ESLint owns local binding correctness, React and Hooks feedback, accessibility,
test API usage, and direct browser-capability boundaries such as `process`,
storage, SDK globals, script insertion, native HTTP access, retired Axios, and
Toss imports. It does not own
module direction or cycles, production reachability, unused dependencies, or
CSS policy; those remain with dependency-cruiser, Knip, and Stylelint/contracts.
The semantic verifier evaluates the resolved flat configuration through
ESLint's public API. Unused disable directives and unused inline configuration
entries are errors; active suppressions remain visible and require a narrow,
reviewable reason.

Knip reaches Vite, Vitest, Stylelint, and the other tool configuration through
canonical explicit `entry`/`project` globs. Those framework plugins are
disabled because the explicit graph owns reachability while the dedicated
architecture tests own resolved config semantics.

`architecture-ratchet.json` is the single changed-surface registry. A feature
may be added to `migratedFeatures` only in the same atomic cutover that leaves
that feature with zero dependency-direction and strict design-policy errors
while the global production Knip gate remains green. Knip is not scoped by this
registry. Every entry must resolve to a real feature directory containing
production source; symbolic links are forbidden throughout `src` so fixed or
feature target layers cannot be relocated behind legacy paths.
Full-history CI and the local Git comparison gate make the
list monotonic: an entry is removed only when its owning production feature root
is intentionally deleted. Current feature discovery must equal the registry in
both directions; this prevents both unregistered current scopes and stale policy
entries. Adding an ignore, known-violation snapshot, or blanket file exception is
not a cutover. A new or renamed feature root must enter the registry in the same
commit, and a parent registration counts only production source owned by that
parent, never source owned by a declared nested scope. Historical nested entries
remain comparable after their root and scope declaration are retired.

## Dependency-cruiser policy

The production graph has zero cycles, zero warnings, and zero errors.
Volatile module and edge totals belong to executable command output rather than
this hand-maintained contract. Production contains no
feature-owned `appShell.ts` or `publicCache.ts`, no feature-to-peer edge, and no
retired global API/DTO root. Feature-to-peer production imports are errors regardless of filename;
production imports of `src/api/**` or `src/types/**` are rejected
across every layer, including non-UI feature modules.

The graph blocks unresolved imports, production imports of tests or runtime dev
dependencies, every feature peer import, retired global API/DTO imports, and
upper-layer imports from target layers. App composition may import a feature only through `ui/**`, `ports/**`,
or that feature scope's root `public.ts`/`public.tsx`; hooks, components, models,
and other implementation paths stay private. Public `ui/**` and `public.ts(x)`
surfaces are presentation boundaries and cannot reach global API or wire DTO
modules. The same ownership matcher handles top-level features and declared
nested scopes. `accommodations/edit` remains a historical/fixture classification
for Git-baseline comparison, but discovery does not activate it after its U12
source directory is deleted. `accommodations/listing-editor` is the active,
strictly registered nested editor owner. Target
module and folder cycles are errors; legacy folder cycles are not reported
because nested-folder expansion produced noisy duplicates.

U6 added one temporary exact bridge per compatibility adapter under
`src/app/router/routes/**`. U7 removed Login, Signup, and Wishlist; U8 removed
Search; U9 removed Detail and Review; U10 removed Confirm, Payment Success, and
Payment Fail; U12 removed Accommodation Edit; U13 removed Profile and both
reservation-detail bridges; U21 removed the final Home bridge. App route
adapters now follow the ordinary feature public-surface rule without bridge
exceptions.

The fixture runner proves 37 cases, including a valid DAG, MJS graph coverage,
the app feature public-surface contract, workflow/screen peer edges,
screen-to-platform, shared-to-page, parent/editor and private feature imports,
explicit rejection of peer `appShell.ts`/`publicCache.ts` filenames,
production-wide retired API/DTO imports from both UI and non-UI features,
module and folder cycles, a type-only cycle, production-to-test/dev imports
(including `__tests__` and `__mocks__`), and an unresolvable edge. It checks the
exact rule set, not only the process exit code. Feature discovery runs against
each fixture root rather than borrowing the production repository inventory.

## Knip reachability policy

`npm run lint:dead-code` is the complete, blocking production Knip scan. It has
no target preprocessor or debt baseline: every production-unused file, value
export, type export, namespace export/type, enum or namespace member, and
duplicate export is a repository-wide error. JavaScript, JSX, and MJS are
included alongside TypeScript. Route modules are not registered as artificial
entries; the production entry must reach them through literal dynamic imports.
The Knip fixture proves that a lazy route and its screen remain reachable while
dead TS, JS, JSX, and MJS files in target and former legacy roots fail the same
global command. Test helpers under `__tests__` and `__mocks__` remain outside
production and cannot be added as fake production consumers.

`npm run lint:dead-code:report` runs the same complete production analysis with
a non-blocking exit code for diagnosis. A clean revision produces an empty issue
report; the report command is not an allowlist or an alternate acceptance gate.

`npm run lint:dependencies` runs two complementary Knip 6 passes. The full
development graph checks runtime and development declarations, unlisted
imports, and binaries. The strict production graph then excludes test/tool
reachability and proves that browser runtime imports come only from
`dependencies`, while build/test-only packages do not hide there. The fixture
suite proves misplaced runtime and test-only packages, unused runtime packages,
unlisted imports, and unlisted binaries. The old new-debt/Git-delta bridge and
its baseline are deleted.

This private app forbids root `optionalDependencies`, `peerDependencies`,
install redirection/bundling sections (`overrides`, `resolutions`, and bundled
dependency metadata), and non-empty npm `workspaces`. `package-lock.json` is the
sole install-graph lock owner; `npm-shrinkwrap.json` is rejected. The lockfile
root declarations must exactly match the manifest. Runtime and development
dependencies use registry semver declarations only: npm aliases, tags, URLs,
and local/Git specs are rejected.

CI validates the exact Knip schema, entry roots, project coverage, explicit
plugin ownership, and rule severities. `cycles` is intentionally off because
dependency-cruiser is the sole cycle owner; every other configured Knip issue
is an error. Ignore/exclude keys, artificial production entries, narrowed
source globs, and weakened rules fail before Knip runs.

## Stylelint owner

U3 scans 60 CSS files. The report-only baseline is 231 warnings, including 41
raw color references, 34 `!important` declarations, sixteen raw radii, three
raw shadows, two protected-literal warnings outside the already-clean scope,
and two unknown local custom-property references.
Strict design-policy errors are zero.

U8 registers Search as strict. Its route CSS now lives with the Search screen;
Search component/screen CSS uses canonical tokens and contains no strict
Stylelint or focused design-contract errors. The full report retains 154 legacy
warnings across 20 files outside strict migrated ownership.

Standard CSS violations, raw colors/radii/shadows, off-scale breakpoints,
`!important`, unknown custom properties, and unknown custom media are errors in
target and migrated styles. Raw token declarations are allowed only in the
primitive token file. Semantic and component token files must contain direct
aliases, and token references may only point to the same or an earlier layer;
same-layer references must point to an earlier declaration. The centralized
policy lists every token's exact owner, so moving a semantic `--color-*` or
component `--layout-*` token into another file is an error even when its value
would otherwise be valid. Primitive private tokens use neutral palette,
elevation, stack, size, environment, and ratio scales rather than app concepts.
Stylelint's built-in rules do not resolve this cross-file token ownership, so the local
design-contract plugin reads that policy. Component-local custom properties
remain available for runtime and component-token composition, but radius,
shadow, color/background, and aspect ratio aliases must resolve directly to
canonical tokens. Custom-media
declarations have one owner and are forbidden outside canonical custom-media
files. Vite already owns the transform, but `cfdb1e4` has no production named
alias consumer. Real consumer migration, a decreasing raw-media ratchet, and
built-CSS resolution proof remain 2026-09-01 plan U15 work; transform ownership
alone is not a completion claim. The agreed breakpoint scale is a pre-existing global invariant, so an
off-scale media value is an error even in otherwise warning-only legacy CSS.

The custom Stylelint contract does not yet own the focused transition-all, raw z-index,
focus-visible pairing, or token-equivalent spacing/font checks. Their Vitest
contracts consume the same `isStrictStylePath` policy, so registering a feature
also makes those checks blocking. U15/U23 may move them into a supported lint
rule only after equivalent failing fixtures exist.

Strict CSS may not disable policy or standard rules. The sole exception is a
single-line, described `disable-next-line declaration-no-important` immediately
before one declaration in an integration-owned `*.vendor.css` file.
Descriptionless, invalid-scope, needless, unscoped, multiline/file-wide,
non-vendor, or unrelated vendor disables fail. The style fixtures prove both
the design-value rules and the suppression boundary while preserving
warning-only legacy debt.

## Prettier owner

Prettier owns layout only; it does not sort imports, rewrite architecture, or
replace ESLint/Stylelint correctness rules. `.editorconfig` fixes UTF-8, LF,
final newlines, two-space indentation, and trailing-whitespace behavior.
`.prettierignore` is the executable ownership boundary for build/test output,
local tool state, npm's generated lockfile, binary assets, archived documents,
historical plans, and three paragraph-heavy architecture registries whose wide
tables stay compact and hand-maintained. The public API fixture proves config
resolution, actual TypeScript formatting, EditorConfig inheritance, and every
important ignore class. `format:check` runs inside the canonical architecture
gate.

## Commands

```bash
npm run test:architecture-rules
npm run lint:architecture
npm run lint:dead-code
npm run lint:dependencies
npm run lint:styles
npm run format:check
npm run lint:architecture-tools
npm run verify:architecture
npm run report:architecture
```

`verify:structure` and CI run the blocking commands. `report:architecture`
prints the complete production Knip report (expected empty) and the remaining
legacy Stylelint inventory without converting either into a permanent
suppression.

## Toolchain transition

U23 pins dependency-cruiser 18.2.0, Knip 6.33.0, Stylelint 17.14.1,
stylelint-config-recommended 18.0.0, and stylelint-config-standard 40.0.0. The
runtime/compiler floor is Node `^22.13 || ^24`, TypeScript 5.9.3, and ESLint
9.39.5 with native flat configuration. TypeScript and PostCSS are direct
development dependencies; the no-op `web-vitals` runtime package is removed.
React Router 7.18 replaces the advisory-affected routing runtime. U18 retires
Axios in favor of the platform-owned browser transport, while keeping its
cookie, timeout, cancellation, envelope, multipart, upload-progress, and safe
error contracts executable. The full locked install graph reports zero known
vulnerabilities as of the U23/U18 cutover, and the removed runtime dependency
provides the final initial-graph reduction instead of hiding code behind an
unused export.
Prettier 3.9.6 and EditorConfig complete U23 with one independent mechanical
formatter-owned pass and a CI-reachable drift gate.
U18 closes production reachability globally: the strict production Knip command
has no result preprocessor and the current production graph has zero unused
files, value/type exports, or duplicate exports.
