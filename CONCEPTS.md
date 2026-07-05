# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Frontend Verification Workflow

### Architecture Verification Loop
The pre-design workflow that combines static architecture contracts, authenticated browser smoke checks, review passes, and final verification before broad styling work begins.

### Verification Gate
The automated portion of the Architecture Verification Loop that proves type safety, test coverage, production build viability, QA checklist coverage, and credential hygiene before a branch is considered ready for design work.

### Design-Ready Smoke Gate
The browser-backed portion of the verification workflow that checks route shells at desktop and mobile sizes before broad visual styling begins.

Dynamic data routes in this gate are either covered with out-of-band identifiers or reported as skipped; skipped routes are not treated as verified coverage.

### Browser Smoke QA
The user-flow verification pass that exercises the app in a real browser at desktop and mobile sizes using the thread-provided QA account when authenticated data is required.

### Feature App-Shell Entry Point
A public feature boundary that exposes only the behavior needed by application shell components, keeping layouts and headers from depending on feature internals.

### Feature Route Barrel
A public feature boundary that exposes route containers to page adapters without exposing the feature's workflow internals.

Feature Route Barrels are distinct from Feature App-Shell Entry Points: page adapters use them to mount route containers, while feature-owned containers compose hooks, panels, helpers, and CSS inside the feature boundary.

### Thread-Provided QA Account
The shared test account supplied in the conversation for authenticated QA flows. Its values may be used locally for testing but must not be written into repository files or generated documentation.

### Responsive Contract
A narrow regression test that encodes a browser-discovered responsive layout invariant, such as preventing a mobile route screen from exceeding the viewport width.
