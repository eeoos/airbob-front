# Host policy contracts

`host-policy-contracts.json` mirrors the backend fixture under
`src/test/resources/contracts`. `PolicyResponseJsonTest` verifies the `policy`
portion of actual `HostDetail` DTOs for absent, partial, and complete policies.

The current backend represents no policy with an object of null fields. The
editor also accepts a null policy and missing individual fields. Missing fields
use the displayed defaults on save; existing numeric counts are preserved.
The fixture does not represent an entire HTTP response.

`host-accommodation-editor.json` is the full current host detail DTO, verified
by `AccommodationResponseJsonTest`. It retains the saved time zone but excludes
`host`, `coordinate`, and `review_summary`. API adapter and browser tests use it
to verify editing, saving, publishing, and image actions with the reduced response.
Browser tests substitute local synthetic image URLs.
