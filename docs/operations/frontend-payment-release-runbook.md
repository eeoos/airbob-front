# Frontend Payment SDK Release Runbook

## Status

U11 is a Vercel Preview candidate for a portfolio service that uses Toss Payments sandbox only. The frontend deploys through the GitHub-connected Vercel project and calls the always-on OCI backend. No real-money payment is in scope.

The merge gate is therefore proportional: keep production untouched while the branch Preview is checked, preserve U10 as a Git/Vercel deployment target, and require all repository gates to be green. A separate artifact store, production payment operator, and real-money rollback drill are not required for this project.

## Release identities

| Release | Git identity | Role |
| --- | --- | --- |
| Pre-U10 | `02a5228f11236e8ba3394fa4ba8fa550c856bc5b` | Legacy migration input producer only; never use after U10 records exist. |
| U10 | `408d3030e3250365ae5dfac0ff258ddddefbb7c0` | Minimum rollback/comparison target with the versioned checkout/callback schema and v1 gateway. |
| U11 | Reviewed branch commit and its commit-specific Vercel URL | Same U10 browser/server contracts with the official npm v2 gateway only. |

Vercel creates Preview deployments for non-production Git branches and commit-specific URLs remain tied to one commit. Record the U11 commit URL from the deployment. If U10 needs a fresh comparison URL, create a targeted deployment from its SHA in the Vercel dashboard or push a temporary comparison branch pointing at that commit.

- [Vercel Git deployments](https://vercel.com/docs/git)
- [Vercel generated deployment URLs](https://vercel.com/docs/deployments/generated-urls)

## Preview configuration

The project owner confirmed that Vercel environment variables are configured. The Preview build must still prove the following categories without printing their values:

- `REACT_APP_API_URL`: the HTTPS OCI backend origin;
- `REACT_APP_TOSS_CLIENT_KEY`: an API-individual sandbox key beginning with `test_ck_`;
- the existing Google Maps and CloudFront browser-public values when those flows are exercised.

OCI must accept the Preview origin under the existing credentialed CORS/session policy. Do not copy keys, cookies, reservation IDs, payment keys, names, or email addresses into deployment notes or test artifacts.

## Vercel Preview sandbox check

Use the exact U11 commit Preview with screenshot, trace, video, and HAR disabled by default. Record only safe status codes, counts, durations, and pass/fail results.

1. Load the official `/v2/standard` SDK and observe zero v1 requests.
2. Create one OCI-backed reservation and open one `CARD`/`KRW` sandbox payment request.
3. Verify a double click still produces one request.
4. Cancel the payment and retry from the preserved checkout.
5. Complete one sandbox success redirect and verify callback credentials are scrubbed before authenticated rendering.
6. Verify exact order/amount ownership and one confirm POST; ambiguous outcomes reconcile through status only.
7. Exercise the fail callback and verify it sends no confirm POST.
8. Leave the checkout route and verify the v2 launcher is destroyed once.

Invalid-key, network-failure, timeout, malformed runtime, and duplicate-request branches remain deterministic automated checks; changing the shared Vercel sandbox key solely to reproduce them is unnecessary.

## U10 compatibility check

Open U10 and U11 by their commit-specific Vercel URLs rather than mounting both runtimes in one build.

1. Confirm U10 can build against the same OCI API category and sandbox key category.
2. Confirm U11 still writes the U10 checkout/callback schema.
3. For a retryable callback, verify the recovery path performs status reconciliation without a second payment request or confirm POST.
4. Confirm each deployment can still load its own hashed lazy chunks.

Because U11 remains a Preview until these checks pass, a failed candidate is handled by not merging it. A production rollback drill is optional for the sandbox portfolio service. After a later production deployment, Vercel Instant Rollback can restore the immediately previous production deployment on Hobby; Preview deployments themselves are not Instant Rollback targets.

- [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback)

## Completion record

U11 is complete when all entries are satisfied:

- [ ] reviewed U11 commit and commit-specific Preview URL recorded
- [ ] Vercel Preview build succeeded with the configured OCI/sandbox categories
- [ ] sandbox cancel, retry, success, fail, confirm, and status checks passed
- [ ] U10 commit remains available as a comparison/redeploy target
- [x] retired `src/platform/integrations/tossPaymentsV1.ts` removed
- [x] source and production build enforce v2-only runtime ownership
- [x] Knip, architecture, test, browser, lint, and build gates green in the reviewed worktree
