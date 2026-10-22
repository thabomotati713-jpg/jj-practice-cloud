export type NoteFields = {
  history_of_present_illness: string;
  examination: string;
  treatment: string;
  follow_up_notes: string;
};
export type VisitTemplate = {
  id: string;
  label: string;
  group: string;
  fields: NoteFields;
};
const plan =
  "Options discussed:\nAgreed management plan:\nMedication decisions:\nPatient advice and safety-netting:";
const follow =
  "Review interval:\nResults to review:\nReturn precautions discussed:";
const template = (
  id: string,
  label: string,
  group: string,
  history: string,
  exam: string,
): VisitTemplate => ({
  id,
  label,
  group,
  fields: {
    history_of_present_illness: history,
    examination: exam,
    treatment: plan,
    follow_up_notes: follow,
  },
});
export const VISIT_TEMPLATES: VisitTemplate[] = [
  template(
    "general",
    "General consultation / SOAP",
    "General practice",
    "Onset and duration:\nSymptoms and impact:\nRelevant history:\nCurrent medicines:\nPatient concerns:",
    "General observations:\nFocused examination:\nRelevant findings:",
  ),
  template(
    "follow-up",
    "Follow-up review",
    "General practice",
    "Reason for review:\nChanges since last visit:\nResponse to the previous plan:\nAdherence / adverse effects:\nPatient concerns:",
    "Current observations:\nFocused reassessment:\nComparison with documented prior findings:",
  ),
  template(
    "hypertension",
    "Blood-pressure review",
    "Chronic care",
    "Symptoms / concerns:\nHome readings reported:\nCurrent medicines and adherence:\nAdverse effects:\nLifestyle discussion:",
    "Measured observations:\nCardiovascular examination:\nOther findings:",
  ),
  template(
    "diabetes",
    "Diabetes review",
    "Chronic care",
    "Symptoms / concerns:\nHome glucose history reported:\nCurrent medicines and adherence:\nHypoglycaemia history discussed:\nScreening and previous results to review:",
    "Measured observations:\nFoot examination findings if performed:\nOther focused findings:",
  ),
  template(
    "respiratory",
    "Respiratory symptoms",
    "General practice",
    "Symptoms, onset and duration:\nBreathing symptoms:\nAssociated symptoms and exposures:\nRelevant history / medicines:\nPatient concerns:",
    "Measured observations:\nRespiratory examination:\nOther relevant findings:",
  ),
  template(
    "wound",
    "Wound / dressing visit",
    "General practice",
    "Site and mechanism:\nDate and progression:\nPrevious treatment:\nRelevant medical history:\nPatient concerns:",
    "Wound location and description:\nMeasurements if taken:\nSurrounding skin / neurovascular findings:\nProcedure performed, if any:",
  ),
  template(
    "child",
    "Child health visit",
    "Paediatrics",
    "Parent / caregiver concerns:\nFeeding / intake and activity:\nGrowth / developmental history:\nImmunisation history reviewed:\nRelevant symptoms:",
    "Measured growth and observations:\nExamination performed:\nDevelopmental observations:",
  ),
  template(
    "vaccination",
    "Immunisation visit",
    "Paediatrics",
    "Reason for visit:\nVaccination history reviewed:\nConsent and screening discussed:\nRelevant allergies / previous reactions:",
    "Assessment performed:\nVaccine / batch / expiry if administered:\nSite and route if administered:\nObservation and advice recorded:",
  ),
  template(
    "dental",
    "Dental assessment",
    "Dentistry",
    "Presenting dental concern:\nPain history / triggers:\nPrevious treatment:\nRelevant medical / medicine history:",
    "Extra-oral findings:\nIntra-oral findings:\nTeeth / sites assessed:\nPeriodontal findings:\nImaging reviewed, if any:",
  ),
  template(
    "dental-followup",
    "Dental procedure review",
    "Dentistry",
    "Procedure / reason for review:\nSymptoms since procedure:\nPatient concerns:",
    "Sites reviewed:\nHealing / examination findings:\nIntervention performed, if any:",
  ),
  template(
    "optometry",
    "Eye examination",
    "Optometry",
    "Visual concerns:\nCurrent correction:\nOcular and medical history:\nRelevant medicines / family history:",
    "Visual acuity measured:\nRefraction findings:\nAnterior / posterior segment findings:\nOther tests performed:",
  ),
  template(
    "physio",
    "Physiotherapy assessment",
    "Physiotherapy",
    "Main concern and goals:\nOnset / mechanism:\nFunctional limitations:\nRelevant history and screening:",
    "Observation:\nRange of movement:\nStrength / functional assessment:\nTests performed and findings:",
  ),
  template(
    "skin",
    "Skin assessment",
    "Dermatology",
    "Site, duration and progression:\nSymptoms / triggers:\nProducts and previous treatments:\nRelevant history:",
    "Sites examined:\nLesion description and distribution:\nRelevant examination / dermoscopy findings:",
  ),
  template(
    "mental-health",
    "Mental-health review",
    "General practice",
    "Presenting concerns and duration:\nImpact on function / sleep:\nRelevant history and medicines:\nRisk assessment discussion:\nPatient priorities:",
    "Observations and mental-state examination:\nAssessment tools used, if any:\nRisk assessment findings:",
  ),
  template(
    "antenatal",
    "Antenatal review",
    "General practice",
    "Reason for review:\nPregnancy history and reported symptoms:\nPrevious care / results to review:\nCurrent medicines / supplements:\nPatient concerns:",
    "Measured observations:\nExamination performed:\nRelevant findings:",
  ),
  template(
    "teleconsult",
    "Online consultation",
    "General practice",
    "Identity / location confirmed:\nConsent for online consultation:\nPresenting symptoms and duration:\nRelevant history / medicines:\nPatient concerns:",
    "Observations possible remotely:\nExamination limitations:\nNeed for in-person assessment considered:",
  ),
];
export function fillEmptyNotes(
  current: NoteFields,
  preset: VisitTemplate,
): NoteFields {
  return Object.fromEntries(
    Object.entries(current).map(([key, value]) => [
      key,
      value.trim() ? value : preset.fields[key as keyof NoteFields],
    ]),
  ) as NoteFields;
}
export function patientContext(
  allergies: string | null,
  chronic: string | null,
) {
  return `Patient-record context — verify for this visit:\nAllergies on file: ${allergies?.trim() || "Not recorded"}\nChronic conditions on file: ${chronic?.trim() || "Not recorded"}`;
}
export function appendNote(existing: string, added: string) {
  return [existing.trim(), added.trim()].filter(Boolean).join("\n\n");
}

export type Investigation = {
  id: string;
  name: string;
  category: string;
  status: "planned" | "ordered" | "performed" | "resulted" | "cancelled";
  location: "practice" | "external";
  specimen: string;
  performed_on: string;
  result: string;
  unit: string;
  reference_range: string;
  notes: string;
};
export type Transcript = {
  text: string;
  reviewed: boolean;
  language: string;
  mode: "typed" | "local" | "browser_service";
};
export type EncounterDetails = {
  version: 1;
  template_id: string;
  tests: Investigation[];
  transcript: Transcript;
};
export const emptyEncounter = (): EncounterDetails => ({
  version: 1,
  template_id: "",
  tests: [],
  transcript: { text: "", reviewed: false, language: "en-ZA", mode: "typed" },
});
export const TEST_CATALOG = [
  ["Full blood count (FBC)", "Blood / pathology"],
  ["HbA1c", "Blood / pathology"],
  ["Urea, electrolytes and creatinine", "Blood / pathology"],
  ["Liver function tests", "Blood / pathology"],
  ["Lipid profile", "Blood / pathology"],
  ["Thyroid function tests", "Blood / pathology"],
  ["C-reactive protein (CRP)", "Blood / pathology"],
  ["Erythrocyte sedimentation rate (ESR)", "Blood / pathology"],
  ["Ferritin / iron studies", "Blood / pathology"],
  ["Vitamin B12", "Blood / pathology"],
  ["Vitamin D", "Blood / pathology"],
  ["Blood glucose (laboratory)", "Blood / pathology"],
  ["Renal function / eGFR", "Blood / pathology"],
  ["Troponin", "Blood / pathology"],
  ["Urinalysis / urine dipstick", "Point of care"],
  ["Capillary blood glucose", "Point of care"],
  ["Urine pregnancy test", "Point of care"],
  ["HIV rapid test", "Point of care"],
  ["Malaria rapid test", "Point of care"],
  ["COVID-19 antigen test", "Point of care"],
  ["Rapid streptococcal antigen test", "Point of care"],
  ["Haemoglobin (point of care)", "Point of care"],
  ["Peak expiratory flow", "Point of care"],
  ["Pulse oximetry", "Point of care"],
  ["Urine microscopy, culture and sensitivity", "Microbiology"],
  ["Sputum microscopy / culture", "Microbiology"],
  ["Sputum TB molecular test", "Microbiology"],
  ["Wound swab culture", "Microbiology"],
  ["Stool microscopy / culture", "Microbiology"],
  ["Blood culture", "Microbiology"],
  ["ECG", "In-practice assessment"],
  ["Spirometry", "In-practice assessment"],
  ["Visual acuity", "In-practice assessment"],
  ["Refraction", "In-practice assessment"],
  ["Intraocular pressure", "In-practice assessment"],
  ["Audiometry", "In-practice assessment"],
  ["Dental radiograph", "Imaging"],
  ["Chest radiograph", "Imaging"],
  ["Ultrasound", "Imaging"],
  ["Other investigation", "Other"],
] as const;
export function newInvestigation(
  name: string,
  category: string,
  id: string,
): Investigation {
  return {
    id,
    name,
    category,
    status: "planned",
    location: "practice",
    specimen: "",
    performed_on: "",
    result: "",
    unit: "",
    reference_range: "",
    notes: "",
  };
}
export function parseEncounter(value: unknown): EncounterDetails {
  if (typeof value === "string") {
    try {
      return parseEncounter(JSON.parse(value));
    } catch {
      throw new Error(
        "The saved investigations or transcript could not be read. Keep this tab open and reload the draft before saving.",
      );
    }
  }
  if (value == null) return emptyEncounter();
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error(
      "Unsupported saved consultation details. Reload before saving.",
    );
  if (Object.keys(value).length === 0) return emptyEncounter();
  const v = value as EncounterDetails;
  const keys = [
    "id",
    "name",
    "category",
    "status",
    "location",
    "specimen",
    "performed_on",
    "result",
    "unit",
    "reference_range",
    "notes",
  ] as const;
  if (
    v.version !== 1 ||
    typeof v.template_id !== "string" ||
    !Array.isArray(v.tests) ||
    v.tests.some(
      (t) =>
        !t ||
        typeof t !== "object" ||
        keys.some((k) => typeof t[k] !== "string") ||
        !["planned", "ordered", "performed", "resulted", "cancelled"].includes(
          t.status,
        ) ||
        !["practice", "external"].includes(t.location),
    ) ||
    !v.transcript ||
    typeof v.transcript !== "object" ||
    typeof v.transcript.text !== "string" ||
    typeof v.transcript.reviewed !== "boolean" ||
    typeof v.transcript.language !== "string" ||
    !["typed", "local", "browser_service"].includes(v.transcript.mode)
  )
    throw new Error(
      "Unsupported saved consultation details. Reload before saving.",
    );
  return v;
}
export function validateEncounter(value: EncounterDetails) {
  if (value.tests.length > 40)
    return "Record up to 40 investigations in one consultation.";
  if (new Set(value.tests.map((t) => t.id)).size !== value.tests.length)
    return "Duplicate test identifiers. Reload the consultation.";
  for (const test of value.tests) {
    if (!test.name.trim() || test.name.length > 160)
      return "Each investigation needs a name of up to 160 characters.";
    if (test.status === "resulted" && !test.result.trim())
      return `Enter the result for ${test.name}, or change its status.`;
    if (
      test.result.length > 4000 ||
      test.notes.length > 2000 ||
      test.specimen.length > 100 ||
      test.unit.length > 40 ||
      test.reference_range.length > 200 ||
      test.category.length > 80
    )
      return `Shorten the result or notes for ${test.name}.`;
    if (test.performed_on) {
      const d = new Date(`${test.performed_on}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(test.performed_on) ||
        !Number.isFinite(d.getTime()) ||
        d.toISOString().slice(0, 10) !== test.performed_on
      )
        return `Enter a valid date for ${test.name}.`;
    }
  }
  if (value.transcript.text.length > 20000)
    return "Keep the transcript within 20,000 characters.";
  if (value.transcript.text.trim() && !value.transcript.reviewed)
    return "Review and confirm the transcript before completing the consultation.";
  if (new TextEncoder().encode(JSON.stringify(value)).length > 100000)
    return "The investigations and transcript are too large for one consultation.";
  return null;
}

export type SpeechResultList = ArrayLike<{
  isFinal: boolean;
  [index: number]: { transcript: string };
}>;
// Result indices are stable within a recognition session. Repeated events must
// not append a final phrase twice; provisional words are displayed separately.
export function collectSpeech(results: SpeechResultList, seen: Set<number>) {
  const final: string[] = [],
    interim: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const text = results[i][0]?.transcript.trim();
    if (!text) continue;
    if (results[i].isFinal) {
      if (!seen.has(i)) {
        seen.add(i);
        final.push(text);
      }
    } else interim.push(text);
  }
  return { final: final.join(" "), interim: interim.join(" ") };
}
