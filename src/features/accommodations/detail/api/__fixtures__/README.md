# Coupon response contracts

The JSON files mirror the backend's `src/test/resources/contracts` fixtures.
`CouponResponseJsonTest` verifies them against DTOs created from domain entities
and serialized with the backend Jackson configuration. Keep the copies in both
repositories in sync when changing the response contract.

- `coupon-campaigns.json`: upcoming, open and sold-out campaigns, with separate
  issuance and usage periods.
- `member-coupons.json`: available, upcoming, used, expired and unavailable owned
  coupons, including an available coupon from a sold-out or ended campaign.

Period strings are backend-local `Asia/Seoul` times. The UI displays them as Korean
time and uses the server's status rather than inferring eligibility from the
browser clock. Selection refreshes the owned coupon status; quote and checkout
remain authoritative for the discount and final eligibility.
