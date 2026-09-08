# Wishlist detail response contract

`wishlist-detail-without-reviews.json` mirrors the backend's
`src/test/resources/contracts/wishlist-detail-without-reviews.json`.
`WishlistDetailQueryIntegrationTest` verifies the fixture against a real MySQL
query result serialized using the backend Jackson configuration. Keep both copies
in sync when the response contract changes.

An accommodation without a review summary row has a numeric `total_count: 0` and
`average_rating: 0`. It remains a valid wishlist card; the frontend hides its
rating and keeps the accommodation ID distinct from the wishlist item ID used for
memo updates and removal.
