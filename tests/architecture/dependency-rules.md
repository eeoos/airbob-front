# Frontend Architecture Ratchets

This document is the executable-policy companion to the canonical frontend
architecture. It records which tool owns each static rule, the measured U3
baseline, and how a migrated slice becomes strict without a suppression wall.

## Single rule owners

| Concern | Owner | Blocking scope at U3 | Legacy signal |
| --- | --- | --- | --- |
| Import direction, resolvability, production-to-test/dev edges, module/folder cycles | dependency-cruiser | `src/app`, `screens`, `workflows`, `platform`, `shared`, plus features registered as migrated | Existing feature cycles and peer edges are warnings. Private peer imports remain errors. |
| Production reachability, unused files/exports/dependencies | Knip | The same target/migrated surface through a result preprocessor | Full production report is non-blocking and contains no per-file ignore list. |
| CSS syntax and design references | Stylelint | Target/migrated CSS plus the already-clean shell/modal files named in config | Legacy design/syntax debt is warning-only; breakpoint and suppression invariants remain global errors. |
| CSS interaction/token invariants not expressible by the pinned Stylelint line | Focused Jest contracts using the central style policy | Target/migrated CSS plus the named high-risk pre-redesign set | No duplicated raw-color, `!important`, or import scanner remains. |
| Local TypeScript/JavaScript feedback | ESLint | Existing strict source gate and architecture-tool scripts, including CRA-resolved `.mjs` modules | None for files in strict scope. |
| Runtime behavior | Jest and deterministic Playwright | Current behavior and migrated flows | Target behavior is never counted through skips. |

`architecture-ratchet.json` is the single changed-surface registry. A feature
may be added to `migratedFeatures` only in the same atomic cutover that leaves
that feature with zero dependency, reachability, and strict design-policy
errors. Every entry must resolve to a real feature directory containing
production source; symbolic links are forbidden throughout `src` so fixed or
feature target layers cannot be relocated behind legacy paths.
Full-history CI and the local Git comparison gate make the
list monotonic: an entry is removed only when U22 removes that feature root
itself. Adding an ignore, known-violation snapshot, or blanket file exception is
not a cutover. A new or renamed feature root must enter the registry in the same
commit, and a parent registration counts only production source owned by that
parent, never source owned by a declared nested scope. Historical nested entries
remain comparable after their U22 root and scope declaration are retired.

## Dependency-cruiser policy

The production graph at U6 has 422 modules and 1,154 dependency edges. It
records zero errors and 18 legacy warnings:

- two type-bearing module cycles in the accommodation editor;
- sixteen cross-feature compatibility edges.

The graph blocks unresolved imports, production imports of tests or runtime dev
dependencies, private feature peer imports, direct UI access to global API/wire
DTO modules, route/layout seam bypasses, and upper-layer imports from target
layers. App composition may import a feature only through `ui/**`, `ports/**`,
or that feature scope's root `public.ts`/`public.tsx`; hooks, components, models,
and other implementation paths stay private. Public `ui/**` and `public.ts(x)`
surfaces are presentation boundaries and cannot reach global API or wire DTO
modules. The same ownership matcher handles
top-level features and the declared `accommodations/edit` nested scope. Target
module and folder cycles are errors; legacy folder cycles are not reported
because nested-folder expansion produced noisy duplicates.

U6 adds one temporary exact bridge per compatibility adapter under
`src/app/router/routes/**`. Each adapter may import only its assigned legacy
feature route container; a peer route or private helper is still an error.
U7-U13/U21 remove each bridge with that route's screen/controller cutover, and
U22 removes any final compatibility entry.

The fixture runner proves 37 cases, including a valid DAG, MJS graph coverage,
the app feature public-surface contract, workflow/screen peer edges,
screen-to-platform,
shared-to-page, parent/editor and private feature imports, UI/API and UI/DTO
bypasses, route/layout/page bypasses, module and folder cycles, a type-only
cycle, production-to-test/dev imports (including `__tests__` and `__mocks__`),
and an unresolvable edge. It checks the exact rule set, not only the process exit
code. Feature discovery runs against each fixture root rather than borrowing the
production repository inventory.

## Knip reachability policy

`npm run lint:dead-code:report` is the complete production report and always
exits successfully. At U3 it records sixteen unused files and six unused runtime
packages. These are deletion/classification inputs for U7-U23, not an allowlist.

`npm run lint:dead-code` applies the target preprocessor and fails on any issue
whose owning file is under a target root or registered migrated feature. The U3
target count is zero. JavaScript, JSX, and MJS are included alongside TypeScript.
Route modules are not registered as artificial entries: the production entry
must reach them through literal dynamic imports. The Knip fixture proves that a
lazy route and its screen remain reachable while dead TS, JS, JSX, MJS, and a
non-empty migrated-feature entry are reported, test helpers under `__tests__`
and `__mocks__` remain outside production, and legacy-only debt remains
non-blocking.

Package-owned findings cannot be scoped to a feature in Knip 2. The six existing
unused runtime packages therefore stay visible in the full report, while a Git
delta gate rejects any newly added runtime dependency that Knip reports unused.
This private app forbids root `optionalDependencies` and `peerDependencies`,
which Knip 2 cannot classify safely. Root install redirection/bundling sections
(`overrides`, `resolutions`, and bundled-dependency metadata) are also forbidden.
Non-empty npm `workspaces` are forbidden, and `package-lock.json` remains the
sole install-graph lock owner; `npm-shrinkwrap.json` is rejected.
CI validates the exact Knip schema,
entry roots, project coverage, and error-level rule set; ignore/exclude keys,
artificial production entries, narrowed source globs, and disabled rules fail
the fixture before Knip runs. Runtime and development dependencies must use
registry semver declarations: npm aliases, tags, URLs, and local/git specs are
rejected. A changed version declaration is compared against Git history, and a
version change to existing unused debt is treated as new debt.
U23 replaces this bridge with global strict dependency classification.

## Stylelint owner

U3 scans 60 CSS files. The report-only baseline is 231 warnings, including 41
raw color references, 34 `!important` declarations, sixteen raw radii, three
raw shadows, two protected-literal warnings outside the already-clean scope,
and two unknown local custom-property references.
Strict design-policy errors are zero.

Standard CSS violations, raw colors/radii/shadows, off-scale breakpoints,
`!important`, unknown custom properties, and unknown custom media are errors in
target and migrated styles. Raw token declarations are allowed only in the
canonical token files. Stylelint 16 cannot resolve global custom properties
across files, so the local design-contract plugin reads the centralized token
policy. Component-local custom properties remain available for runtime and
component-token composition, but radius, shadow, color/background, and aspect
ratio aliases must resolve directly to canonical tokens. Custom-media
declarations have one owner and are forbidden outside canonical custom-media
files. The agreed breakpoint scale is a pre-existing global invariant, so an
off-scale media value is an error even in otherwise warning-only legacy CSS.

Stylelint does not yet own the focused transition-all, raw z-index,
focus-visible pairing, or token-equivalent spacing/font checks. Their Jest
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

## Commands

```bash
npm run test:architecture-rules
npm run lint:architecture
npm run lint:dead-code
npm run lint:styles
npm run lint:architecture-tools
npm run verify:architecture
npm run report:architecture
```

`verify:structure` and CI run the blocking commands. `report:architecture`
prints the complete legacy Knip and Stylelint inventories for debt-reduction
work without converting those inventories into permanent suppressions.

## Toolchain transition

U3 intentionally pins dependency-cruiser 17.4.3, Knip 2.43.0, Stylelint
16.23.1, stylelint-config-recommended 17.0.0, and
stylelint-config-standard 39.0.0. Knip 5/6 requires TypeScript 5,
and the latest Knip/Stylelint line requires Node 20.19; this repository still
uses CRA, TypeScript 4.9, and supports even Node 20.12, 22, and 24 release lines.

U23 upgrades Node/TypeScript and these static tools together. That unit must
replace the Knip v2 preprocessor with the supported modern mechanism, replace
the local Stylelint token plugin with core cross-file reference rules, revisit
CRA-era syntax exceptions, and preserve every fixture before deleting the old
tool adapters.
