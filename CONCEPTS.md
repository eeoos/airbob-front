# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Frontend Verification Workflow

### Architecture Verification Loop
The pre-design workflow that combines static architecture contracts, authenticated browser smoke checks, review passes, and final verification before broad styling work begins.

### Architecture Freeze
A historical July 2026 milestone that introduced executable boundary checks. It is superseded as an active architecture authority by `docs/architecture/current-frontend-architecture.md`; its tests remain useful evidence until their owning migration unit replaces them.

### Canonical Frontend Architecture
The single current-state source of truth at `docs/architecture/current-frontend-architecture.md`. Migration registries and historical reports link to it instead of restating the architecture.

### Cutover Registry
The route, workflow, and infrastructure ownership ledger at `docs/architecture/frontend-ownership-matrix.md`. Each migration slice records its old owner, target owner, active writer, compatibility path, rollback reader, and removal condition.

### Active Writer
The one implementation allowed to persist or mutate a given state slice during a migration window. Compatibility readers may translate legacy state, but they must not become a second writer.

### Compatibility Reader
A temporary read-only adapter that accepts legacy URLs, navigation state, cache entries, or browser data while the active writer emits only the target representation.

### Subagent Review Loop
A task execution pattern where a fresh implementer is followed by independent spec and code-quality reviewers before the next task begins.

In this workflow, reviewer findings become new regression tests rather than notes. The loop is especially useful when a structure-first refactor touches cache identity, payment redirects, accessibility semantics, or verification harness behavior.

### Structure-First Refactor
A behavior-preserving frontend reorganization that makes ownership boundaries executable before visual redesign, framework migration, or broad product styling begins.

### Verification Gate
The automated portion of the Architecture Verification Loop that proves type safety, test coverage, production build viability, QA checklist coverage, and credential hygiene before a branch is considered ready for design work.

### Architecture Ratchet
The executable static-policy layer owned by dependency-cruiser, Knip, and Stylelint. Existing debt is measured as report-only evidence, while target directories and real production features promoted through the monotonic `architecture-ratchet.json` registry fail immediately on new dependency, reachability, or design-reference violations.

### Pre-Redesign Gate
The static verification threshold that must pass before visual styling begins, focused on type safety, deterministic test coverage, and production build viability.

### Design-Ready Smoke Gate
The browser-backed portion of the verification workflow that checks route shells at desktop and mobile sizes before broad visual styling begins.

Dynamic data routes in this gate are either covered with out-of-band identifiers or reported as skipped; skipped routes are not treated as verified coverage.

### Lint Visibility Gate
A non-blocking verification layer that exposes known lint debt without making unrelated historical lint failures decide whether structure work is ready for visual design.

### Dynamic Smoke Fixture
An out-of-band data identifier or seeded data condition used to make a dynamic browser smoke route verifiable without hardcoding private or environment-specific values.

Dynamic Smoke Fixtures must be supplied through local environment variables or documented fixture setup steps, and their raw values must not be committed to repository files or generated documentation.

### Browser Smoke QA
The user-flow verification pass that exercises the app in a real browser at desktop and mobile sizes using the thread-provided QA account when authenticated data is required.

### Feature App-Shell Entry Point
A legacy public feature seam that exposes behavior to application shell components. Existing `appShell.ts` imports remain production compatibility paths until their ownership-matrix removal conditions are met; they are not the target dependency model.

### Feature Route Barrel
A legacy public feature boundary that formerly exposed route containers to page adapters. Production routing now lazy-loads feature route modules directly, so route barrels are compatibility artifacts rather than a target abstraction.

### Route Adapter
An app-owned route boundary that reads Router state, session, and URL codecs, then passes typed input and navigation commands to a screen controller without changing the public route. It is a permanent target-layer responsibility, not a page-style re-export adapter.

### Screen Controller
A route or workflow owner that coordinates URL state, server state, commands, and navigation, then passes serializable display state and callbacks to a props-only screen.

### Props-Only Screen
A presentation component that receives view state and events through props and does not fetch server data, parse route state, mutate browser storage, or import another feature's internals.

### Workflow
A cross-feature user journey, such as checkout/payment or accommodation editing, with one explicit orchestration owner and feature/domain ports instead of reciprocal feature imports.

### Session Subject
The stable authenticated-user identity used to scope private cache and browser state. A session epoch distinguishes successive login lifecycles for the same or different subject when identity is unavailable or changing.

### Browser Data Inventory
The registry at `docs/architecture/frontend-browser-data-inventory.md` that records browser-persisted and navigation data by purpose, field, privacy class, subject owner, reload need, TTL, cleanup event, artifact policy, and legacy compatibility.

### Route Shell Metadata
Route-owned facts about layout, authentication, and header behavior that layouts consume instead of duplicating shell policy inside pages or components.

### Public Cache Boundary
A legacy feature-owned seam for cache invalidation and reconciliation. It remains a compatibility path during migration, but target workflows use query factories and explicit domain ports without feature-to-feature cache ownership.

### Shared UI Primitive
A domain-free reusable UI building block whose accessibility and interaction semantics are tested independently from route or feature workflows.

### Query-Backed Hook Test Harness
A server-state hook test setup that exercises the same provider context and asynchronous state transitions the hook uses at runtime.

### Thread-Provided QA Account
The shared test account supplied in the conversation for authenticated QA flows. Its values may be used locally for testing but must not be written into repository files or generated documentation.

### Responsive Contract
A narrow regression test that encodes a browser-discovered responsive layout invariant, such as preventing a mobile route screen from exceeding the viewport width.
