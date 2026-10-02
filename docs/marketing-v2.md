# Marketing Command Centre v2

Only marketing routes, demo acquisition, short links and marketing tables change. Clinical modules are untouched. All management API routes require an active superuser; insights and lead PII are never exposed to anonymous or ordinary practice accounts.

## Runtime configuration

Set `WINDSOR_API_KEY` in the existing Vercel project's encrypted server environment (production and preview), and redeploy. Never prefix it with NEXT_PUBLIC. The ChatGPT Windsor connection is independent of the deployed application's credential. Enable organic write actions in Windsor Team management if required. No subscription or advertising purchase is made by this code.

`CRON_SECRET` must be set for the scheduler. Vercel calls `/api/marketing/run` daily at 06:00 UTC / 08:00 SAST. It publishes at most one due, explicitly auto-publish-enabled organic post per run. When there are no due posts it refreshes the last 30 completed SAST calendar days of analytics. The manual sync button is available anytime. Daily scheduling is intentionally conservative; this is not an exact-minute scheduler.

Only Facebook Organic `create_post` and Google Business `create_local_post` are allowed. Facebook Ads is read only. LinkedIn stays pending; other channels use manual sharing. Existing posts do not become automatic retroactively. Public provider posting is not exercised by automated tests.

## Database

`docs/marketing-v2.sql` is the additive migration applied through Supabase migration tooling. Marketing insights use RLS with no client grants/policies deliberately: server service-role access is allowed only after superuser validation. The click increment RPC is security-invoker and callable only by service_role.

Live Windsor snapshots were imported for 2026-09-02 through 2026-10-01. Empty source responses are shown as no rows, not assumed zeros. Facebook Lead imports deduplicate on source/external ID and preserve existing CRM stages/notes. Lead details do not enter analytics snapshots.

## Operations

The content composer supports Google Business and all existing manual share platforms, with reporting added to the feature library. Schedule inputs and CRM demo times use SAST. A demo is a 30-minute internal booking with optional HTTPS meeting URL and downloadable ICS; saving it does not email the prospect. Confirm the appointment directly. Exact demo slot conflicts are blocked by a unique index.

The worker claims a post with a compare-and-set update. Failed/ambiguous sends move to review_required and never auto-retry. Interrupted claims older than ten minutes are also placed in review on the next worker run. Review the provider page before creating a replacement. Successful receipts remain in the private post record.

Tracked links increment atomically and pass campaign ID / UTM values through to the demo form and CRM. Clicks are raw redirect hits, not unique human visitors.

## Validation

- Full Next.js production build.
- TypeScript and focused ESLint.
- Eight marketing tests: organic allowlist, paid/LinkedIn blocking, URL/content validation, timezone scheduling, concurrent publish claims, ambiguous-send no retry, missing credential no mutation, due-only worker rules.
- SQL permission checks and transactional click increment verification.
- Runtime HTTP checks: public pages return 200; marketing read/write and cron routes reject unauthenticated requests with 401.
- CI now uses Node 24 and the actual Next.js build instead of an unrelated webpack command.

No paid campaigns were created, enabled or boosted. Publishing stays unavailable until the server credential is present. Roll back code to the previous deployment if needed; the additive database columns may remain safely.
