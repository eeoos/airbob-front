# Coupon response contracts

The JSON files mirror the backend's `src/test/resources/contracts` fixtures.
`CouponResponseJsonTest` verifies them against DTOs created from domain entities
and serialized with the backend Jackson configuration. Keep the copies in both
repositories in sync when changing the response contract.

- `coupon-campaigns.json`: upcoming, open and sold-out campaigns, with separate
  issuance and usage periods.
- `member-coupons.json`: available, upcoming, used, expired and unavailable owned
  coupons, including an available coupon from a sold-out or ended campaign.

Period strings are ISO 8601 instants with UTC `Z`. The adapter requires an explicit
timezone (`Z` or an offset); timezone-less strings are invalid. The shared coupon
view model formats instants in `Asia/Seoul`, including when the browser uses a
different timezone. Both accommodation detail and reservation review use it.
The UI uses the server's status rather than inferring eligibility from the browser
clock. Selection refreshes the owned coupon status; quote and checkout remain
authoritative for the discount and final eligibility.

Campaign responses do not expose `issued_quantity`, and the UI does not display
remaining stock. Coupon creation and editing have no frontend screen in this
repository; any future admin input must send an instant with `Z` or an explicit
offset. Deploy this contract with the backend's V30 UTC migration and API changes.
