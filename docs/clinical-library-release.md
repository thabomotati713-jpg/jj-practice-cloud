# Clinical library and appearance studio

## Behaviour

- `/clinical-library`: searchable WHO ICD-10 reference with 12,221 code/category entries and 22 chapter filters, terminal primary-code lookup, pagination and direct WHO reference links. The code dataset stays on the server; API responses return at most 50 rows. No patient information is sent to WHO.
- Consultation diagnosis lookup: manual entry stays available. Selecting a code fills the code and fills the diagnosis only when its notes are empty. Existing autosave, recovery and finalisation remain in place. Enter in the search field does not accidentally submit a consultation.
- 127 independently authored generic medication product templates across eight groups. Select individual products or a filtered page and import to the signed-in practice. Imports require an active owner/admin/inventory profile and an active practice, skip existing products across all inventory pages, and use a deterministic unique product code to prevent retry/concurrency duplicates. Imported stock and prices start at zero; existing quantities/prices are never updated.
- GP starter catalogue also includes the medication templates. Other specialty starter catalogues remain available.
- Prescription templates fill product name/form and strength. Selecting a new template clears the old medicine's dose, frequency, duration, instructions, quantity and stock link; the clinician must enter and confirm the prescription. No automatic prescribing, scheduling claims or treatment recommendations.
- `/appearance`: eight previewable themes, twelve accent palettes, four surfaces, two corner styles and two spacing densities. Owners/admins can save only their own practice's appearance. Other users can preview the collection. Superuser global/per-practice editing remains available. Action colours are darkened as needed for white-label contrast.
- Database migration restricts self-profile updates to name/display-name/phone fields so a user cannot edit their own role, tenant, active flag, patient or staff association. Service-role staff administration retains access.

## Data and limits

The WHO reference is the 2019 release including the COVID-19 expansion supplied in 2021. It is not the South African MIT, does not include all clinical coding notes and does not guarantee claim acceptance. Source, edition, unchanged-title attribution and reference links are visible in the interface and `data/README.md`. The SA MIT is linked rather than redistributed.

Medication templates contain generic product facts only; practices must verify exact products, pack units, applicable prescription requirements, prices and supplier stock. No paid API, new package, external messaging service or subscription has been introduced.

## Validation

- 20 automated checks across catalogue search/API pagination, medication template constraints, import roles/inactive practices/errors/retries/large inventories, appearance tenant isolation/validation/contrast, existing consultation drafts, marketing and follow-up rules.
- Changed new-module TypeScript/React files: ESLint, TypeScript, whitespace checks.
- Production Next.js build using the existing dependency lockfile.
- `tests/profile-access.sql`: role/tenant escalation denial, safe self edits, tenant isolation, anonymous denial and service-role privileges; rolled back fixtures.
- Existing `tests/practice-workflow.sql`: 10,000-patient search, full summaries, consultation draft conflict/recovery/finalisation and atomic queue allocation; rolled back fixtures.

## Next improvements

1. A source/version-controlled South African MIT import after the practice confirms redistribution rights for its chosen licensed dataset.
2. Reports with explicit payment-date and invoice-date measures, plus overdue balances and stock-expiry worklists.
3. Encrypted practice export with a manifest and restore validation; attachment export and restoration need separate verification.
4. Real-time team handoff and reminder delivery with consent and delivery status. External message/provider charges must remain explicit.
