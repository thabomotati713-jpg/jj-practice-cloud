# J&J AI: appointment follow-up (Phase 1)

The `/ai/no-show` page reads upcoming appointments and explicit past outcomes from Supabase for the signed-in practice. It queries only that `practice_id`, and existing Supabase row-level policies remain the database boundary. It does not send patient information to an AI provider, create a new table, or require a migration.

The page covers the next 30 calendar days in Africa/Johannesburg time. It uses no-show and cancellation outcomes from the previous 365 days, recorded as `no_show` or `cancelled` in the existing `appointments.status` field. A past booking that remains `scheduled` is **not** inferred to be a no-show.

The follow-up score starts at 20. The first two previous no-shows add 25 each; the first two cancellations add 10 each. An appointment not yet confirmed adds 15 when within 24 hours or 5 when within 72 hours. A confirmed appointment subtracts 10, and no saved phone number adds 10. Scores range from 5 to 95: High is 65+, Medium 35–64, Low below 35. This is a rule-based scheduling priority, **not** a calibrated probability or medical assessment.

Staff can copy a generic reminder for manual review and delivery, or mark an appointment confirmed after speaking to the patient. Copying text does not send a message or change `reminder_sent`. The existing automated reminder service remains separate.

This phase is visible to signed-in active practice users. Commercial entitlement and billing for an AI add-on require a separate subscription system; the UI does not claim that a practice has purchased a tier.

Verification: `node --experimental-strip-types tests/no-show-risk.test.mjs` and `npm run build -- --webpack` (with the normal public Supabase environment variables configured). The test uses synthetic records.
