# Guest reservation review contract

`guest-reservation-reviewable.json` mirrors the backend fixture under
`src/test/resources/contracts`. `ReservationResponseTest` checks actual DTO
serialization; reservation service and MySQL query tests check the decision.

This reservation is `CANCELLATION_FAILED` and checks out exactly at `server_time`.
`can_write_review` is the server decision used by both the reservation detail
button and the review form. Do not recalculate it using the device clock or status.
The POST endpoint revalidates eligibility when submitting the review.
