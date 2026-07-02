# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Frontend Verification Workflow

### Architecture Verification Loop
The pre-design workflow that combines static architecture contracts, authenticated browser smoke checks, review passes, and final verification before broad styling work begins.

### Verification Gate
The automated portion of the Architecture Verification Loop that proves type safety, test coverage, production build viability, QA checklist coverage, and credential hygiene before a branch is considered ready for design work.

### Browser Smoke QA
The user-flow verification pass that exercises the app in a real browser at desktop and mobile sizes using the thread-provided QA account when authenticated data is required.

### Thread-Provided QA Account
The shared test account supplied in the conversation for authenticated QA flows. Its values may be used locally for testing but must not be written into repository files or generated documentation.

### Responsive Contract
A narrow regression test that encodes a browser-discovered responsive layout invariant, such as preventing a mobile route screen from exceeding the viewport width.
