# Consultation workbench

Patients → patient → Consultations → New consultation. Scheduled visits retain the appointment date and reason. The new tools appear above the existing consultation form.

## Faster documentation

- 16 visit templates fill blank history, examination, plan and follow-up sections with prompts. Existing text is preserved. Applying a template does not enter diagnoses, negative findings, measured observations or doses.
- One-click insertion of recorded allergies and chronic conditions, explicitly labelled for verification today. Missing information is labelled “Not recorded”.
- Optional last-visit diagnosis/plan reference includes its date and clearly asks the clinician to reassess. It is never inserted as current findings.
- Changing patient or appointment remounts the editor and stops speech recognition so clinical state cannot carry across visits.

## Labs and investigations

40 searchable investigation names, plus custom tests. Up to 40 entries per consultation. Each records status (planned, requested, performed, resulted, cancelled), in-practice/external location, date, specimen, actual result, units, reported reference range and interpretation/action. New entries start as planned with no invented result, date or reference range. “Result recorded” requires a result. This records the consultation; it does not transmit an external lab order or receive an electronic lab feed. Saved results appear in history and the print view. Pending entries are recorded at completion; this release does not add a separate post-completion results inbox.

## Transcript

Type, paste or optionally dictate into an editable transcript. The application stores text only, up to 20,000 characters. Finalised speech phrases append once; provisional recognition is shown separately. Editing or adding words invalidates review. A non-empty transcript must be confirmed reviewed before completion, both in the client and by a database constraint protecting direct API writes.

Dictation defaults to on-device-only processing and fails closed if that capability/language is unavailable. No automatic remote fallback or language-pack installation occurs. A browser speech service requires an explicit choice and a per-session consent/practice-approval checkbox acknowledging audio may leave the device. Browser, operating-system and language support vary. Typed/pasted text remains available without speech support. The browser may separately request microphone access. No paid transcription provider or API key was added. This is dictation, not speaker diarisation or an AI medical summary.

## Storage and access

Versioned `consultations.encounter_details` JSONB, default `{}` for old records. Existing tenant policies remain in place. Drafts use the existing author-private, revision-locked RPC flow; completed details have the same access rules as the clinical record. Strict server validation covers allowed keys/types, identifiers, statuses, dates, size, required results and transcript review. Finalisation preserves tenant/author checks, appointment completion, draft consumption and retry idempotency. No audio is uploaded by the app.

Migration: `20261022162640_consultation_workbench.sql`, applied to the configured production Supabase project. The release targets Vercel project `jj-practice-cloud-m2ts`. The duplicate unconfigured projects are separate from this working deployment.

## Verification

- `node --test tests/*.test.cjs`: 31 passing, including template preservation, absent-vs-negative history, empty test defaults, draft round-trip, malformed restoration, result/date/size checks, speech result deduplication, consent gating, local-only failure and handler teardown.
- Production webpack build and TypeScript check pass.
- ESLint has no errors in changed files; existing logo `<img>` optimisation warnings remain.
- `tests/consultation-workbench.sql` executed against the database inside a rolled-back transaction: draft round-trip, author/tenant isolation, unreviewed completion rejection, invalid shapes/dates/IDs, direct-write constraint, atomic completion and retry safety pass.
- `tests/practice-workflow.sql` regression passes with 10,000 synthetic patients, draft conflicts, old-client completion and queue operations. All synthetic fixtures rolled back; zero test practices remain.
- Vercel preview browser checks using a temporary synthetic-only component harness: diabetes template fills blank fields and preserves existing history; patient-record context and dated last-visit references insert correctly; ECG search/add works; duplicate addition leaves one entry; missing result blocks completion; entered report/action display in the record; typing requires review; review permits completion; edits invalidate review; browser speech start stays disabled without consent; arrow-key navigation and inherited disabled state work. The harness has no data writes and is removed before merge.
- Authenticated browser save/reload was not exercised because no practice login session was available. The actual draft/finalisation database path was tested separately under authenticated fixture roles, and the draft client state machine has automated tests. Real microphone recognition and accuracy require a supported device and were not tested with patient audio.
