# Practice workflow release

Patients, claims and inventory now search in Postgres and return 25 rows per page. Counts and financial cards cover the whole practice, independently of the visible page. Search treats punctuation literally and rejects oversized requests.

The dashboard uses one RLS-protected summary RPC. Receipts are measured using `payments.payment_date` in Africa/Johannesburg time. Invoice totals exclude future months; overdue balances use the invoice due date. No historic payment dates are inferred or backfilled.

The existing queue API validates the active user's practice and role before calling a service-role-only allocation function. `FOR UPDATE SKIP LOCKED` reserves the next patient in one operation. Manual updates check the previous status and return a conflict if another user changed it. The queue uses the South African day and refreshes on reconnect, focus and a 15-second fallback when realtime is unavailable.

Consultation drafts live in a separate RLS-protected table. Only the author, with an active doctor or owner profile in that practice, can read or save a draft. Drafts are not stored in browser storage. Autosaves are serialised and use optimistic revisions; conflicts do not silently overwrite another tab. The form displays save/recovery status, retries after reconnection and warns before unloading unsaved changes. Only the last successfully saved draft can be recovered after closing a tab while offline.

Finalising a consultation consumes the exact saved draft, creates the clinical record and completes its appointment in one transaction. The draft ID is reused as the consultation ID so retrying an ambiguous response does not create a duplicate visit.

## Database

`supabase/migrations/20261020104112_practice_workflow_release.sql` is the additive migration recorded on the existing PracticeCloud project. User-facing functions use `SECURITY INVOKER` and existing tenant RLS. Anonymous execution is revoked; the queue allocator is executable only by `service_role`. The new table has author and patient/appointment ownership checks. Existing patient records and clinical records are not rewritten.

## Verification

- `node --test tests/consultation-draft.test.cjs tests/no-show-risk.test.mjs tests/marketing.test.cjs tests/inventory-starter.cjs`
- `next typegen`, `tsc --noEmit`, and `npm run build -- --webpack`
- `tests/practice-workflow.sql`: transaction-scoped fixtures covering 10,000 patients, 1,205 claims, 1,006 products, full financial totals, tenant/author isolation, draft conflicts, retry-safe finalisation and queue allocation. The fixture transaction rolls back.

The database security advisor findings are unchanged from the pre-release baseline; this migration adds no security-definer functions or anonymous data access.
