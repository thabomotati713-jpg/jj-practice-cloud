# Automated medical-aid claims

## Working flow

Claims → New Claim, or Invoice → Prepare medical aid claim. Select an unpaid invoice and its completed consultation. The server fills patient identifiers, medical-aid details, the treating practitioner, registered PCNS/professional registration, clinical service date, recorded ICD-10 code, invoice tariff/NAPPI codes, quantities, discounts, tax and amounts. Existing clinical notes, allergies and consultation transcripts are never included in the claim packet.

Missing information and inconsistent invoice totals block submission. A unique same-day consultation can be suggested; multiple visits require a selection. Current source details must still match the reviewed snapshot at approval and dispatch. The practice reviews the exact form and destination and confirms its authority to disclose the displayed information. Approval freezes the PDF and recipient, queues the submission and attempts immediate dispatch.

A form and itemised invoice are generated as a private PDF. Authenticated claim-team users download it through an audited route. The approved PDF is sealed in the server-written outbox; no public patient-document URL is created. Unicode font files and licensing are included in assets/fonts.

## One-time practice setup

Claims → Claim automation settings (owner/admin): enter each treating practitioner's registered seven-digit PCNS number and professional registration, confirm the applicable scheme inboxes accept this practice's claims, and enable reviewed-claim email submissions. Practice Settings supplies the real practice name/address/contact details. Internal practice codes are not used as PCNS numbers.

Initial published route suggestions, checked 22 October 2026:

- Discovery Health Medical Scheme: https://www.discovery.co.za/medical-aid/how-to-claim
- Bonitas Medical Fund: https://www.bonitas.co.za/contact-card/first-time-claim-2/
- Momentum Medical Scheme: https://provider.momentumhealth.co.za/static-assets/siteFiles/Dental%20%20Mouthpart%20abbreviation%20codes%20for%20claims.pdf

Suggestions remain inactive until confirmed by the practice. Exact scheme aliases are used; an administrator's name never routes a different scheme's claim. Unsupported schemes, paid/part-paid invoices, late claims, adjustments and cases needing additional documents use the scheme's approved portal/switch/exception process. This release attaches the generated form and itemised invoice; it does not automatically attach clinical reports, receipts or other supporting documents. Completeness checks do not verify cover, clinical coding appropriateness, tariff eligibility or scheme authorisation. These remain part of the practice's review.

No accredited clearinghouse contract, gateway credentials or paid claims-switch integration was added. The email channel uses existing RESEND_API_KEY and RESEND_FROM_EMAIL configuration; quotas and sender verification still apply. Email service acceptance is distinct from delivery and from the scheme's adjudication/payment. Real scheme responses are recorded separately with a response date and reference. Payments and invoice balances are not inferred from delivery events.

## Automation and reliability

Optional auto-preparation starts only with new eligible invoices after activation. Normal invoice creation prepares a draft; the daily worker catches eligible invoices missed by that request. The Hobby-compatible cron is scheduled around 08:30 Africa/Johannesburg; execution precision depends on the platform. Draft preparation does not approve or send the claim. Approved queued work is also processed by the worker.

The server reserves outbox rows using row locks/SKIP LOCKED. A permanent unique submission per claim prevents a second click from sending another claim. The sealed payload uses a stable provider idempotency key. Definite rate limits permit bounded retries; ambiguous responses, expired leases and changed source data require reconciliation and are never blindly replayed. Other failed/uncertain submissions and scheme corrections require operator reconciliation through the scheme's approved channel in this release.

Delivery can be refreshed through the provider's read API where the configured key permits it. Optional signed webhooks use RESEND_WEBHOOK_SECRET at /api/claims/webhook. Only relevant delivery events/opaque identifiers are retained; provider-returned email bodies are not stored by polling. Receipt replays are idempotent; a late delivered event cannot undo a bounce. CRON_SECRET is required for /api/claims/run, with no fail-open path.

## Access and database

Applied migration: 20261022174228_automated_claims.sql. New tables have RLS and explicit grants. Owner/admin/doctor/billing profiles can read their own practice's claim workflow. Only the server can write settings, packets, approvals or delivery state; only owner/admin can configure credentials and routes. Claim record updates go through the authenticated response endpoint. Legacy status values were corrected to match the database; invoice claim creation no longer labels an unsent claim submitted.

## Verification

- 51 automated tests: source/tenant matching, omission of private notes, stale-source rejection, dispatch gating, exact routing, totals and required fields, transport outcomes, idempotency, worker authentication, invalid webhook rejection, sealed Unicode PDFs and 100-item multipage invoices; existing consultation/catalogue/appearance/marketing tests also pass.
- TypeScript and the production webpack build pass; traced API bundles include the PDF font assets. PDF pages were rendered and inspected.
- Rolled-back tests/automated-claims.sql exercises real database roles, packet grants, source/actor checks, approval and lease deduplication, early/replayed receipts, bounce precedence, safe retry states, expired lease handling and draft catch-up. Existing 10,000-patient workflow regression passes. Test practices and submissions are not retained.
- Security advisors contain no new claim-related findings. Existing unrelated project advisories remain.
- No real medical-aid claim was sent during development. External transport was mocked, while database transitions were executed against rolled-back synthetic fixtures. Live sender permissions and each scheme's acceptance need the practice's real setup. An authenticated browser save/send was not exercised without a practice login session.

## Public client demonstration

/claims-demo is an intentionally fictional, in-memory demonstration. It uses the shared form renderer and completeness checks, but never calls a claim submission API. Buttons explicitly simulate approval/delivery. It is suitable for demonstrating the workflow without patient data or real provider identifiers.
