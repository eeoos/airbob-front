# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Frontend Verification Workflow

### Architecture Verification Loop
The pre-design workflow that combines static architecture contracts, authenticated browser smoke checks, review passes, and final verification before broad styling work begins.

### Architecture Freeze
The point in the frontend verification workflow where ownership boundaries are documented and enforced by executable tests so future audits start from known contracts instead of rediscovering the same structural problems.

### Subagent Review Loop
A task execution pattern where a fresh implementer is followed by independent spec and code-quality reviewers before the next task begins.

In this workflow, reviewer findings become new regression tests rather than notes. The loop is especially useful when a structure-first refactor touches cache identity, payment redirects, accessibility semantics, or verification harness behavior.

### Structure-First Refactor
A behavior-preserving frontend reorganization that makes ownership boundaries executable before visual redesign, framework migration, or broad product styling begins.

### Verification Gate
The automated portion of the Architecture Verification Loop that proves type safety, test coverage, production build viability, QA checklist coverage, and credential hygiene before a branch is considered ready for design work.

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
A public feature boundary that exposes only the behavior needed by application shell components, keeping layouts and headers from depending on feature internals.

### Feature Route Barrel
A public feature boundary that exposes route containers to page adapters without exposing the feature's workflow internals.

Feature Route Barrels are distinct from Feature App-Shell Entry Points: page adapters use them to mount route containers, while feature-owned containers compose hooks, panels, helpers, and CSS inside the feature boundary.

### Route Shell Metadata
Route-owned facts about layout, authentication, and header behavior that layouts consume instead of duplicating shell policy inside pages or components.

### Public Cache Boundary
A feature-owned public API for cache membership, invalidation, or reconciliation that other features may call without importing private query keys or synchronization internals.

### Shared UI Primitive
A domain-free reusable UI building block whose accessibility and interaction semantics are tested independently from route or feature workflows.

### Query-Backed Hook Test Harness
A server-state hook test setup that exercises the same provider context and asynchronous state transitions the hook uses at runtime.

### Thread-Provided QA Account
The shared test account supplied in the conversation for authenticated QA flows. Its values may be used locally for testing but must not be written into repository files or generated documentation.

### Responsive Contract
A narrow regression test that encodes a browser-discovered responsive layout invariant, such as preventing a mobile route screen from exceeding the viewport width.
