"use client";
// Temporary synthetic review harness; removed before merge.
import { useState } from "react";
import ConsultationWorkbench from "@/components/ConsultationWorkbench";
import EncounterRecord from "@/components/EncounterRecord";
import {
  emptyEncounter,
  validateEncounter,
  type NoteFields,
} from "@/lib/consultation-workbench";
export default function Review() {
  const [fields, setFields] = useState<NoteFields>({
    history_of_present_illness: "Synthetic patient-specific history",
    examination: "",
    treatment: "",
    follow_up_notes: "",
  });
  const [details, setDetails] = useState(emptyEncounter);
  const [recording, setRecording] = useState(false);
  const [disabled, setDisabled] = useState(false);
  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: 24 }}>
      <h1 className="page-title">
        Consultation workbench · synthetic review only
      </h1>
      <p>No real patient or database writes. Temporary test page.</p>
      <label>
        <input
          type="checkbox"
          checked={disabled}
          onChange={(e) => setDisabled(e.target.checked)}
        />
        Disable tools
      </label>
      <fieldset
        disabled={disabled}
        style={{ border: 0, padding: 0, marginTop: 20 }}
      >
        <ConsultationWorkbench
          fields={fields}
          onFields={setFields}
          allergies="Synthetic allergy"
          chronic="Synthetic condition"
          previous={{
            date: "2026-10-01",
            diagnosis: "Synthetic previous diagnosis",
            treatment: "Synthetic previous plan",
          }}
          details={details}
          onDetails={setDetails}
          disabled={disabled}
          onRecording={setRecording}
        />
      </fieldset>
      <div className="card" style={{ marginTop: 24, padding: 24 }}>
        <h2>Prefilled fields</h2>
        {Object.entries(fields).map(([k, v]) => (
          <label key={k} className="field">
            <span>{k}</span>
            <textarea
              className="input"
              value={v}
              onChange={(e) =>
                setFields((c) => ({ ...c, [k]: e.target.value }))
              }
            />
          </label>
        ))}
      </div>
      <p role="status">
        Completion check:{" "}
        {recording ? "Stop microphone" : validateEncounter(details) || "Ready"}
      </p>
      <EncounterRecord value={details} />
    </main>
  );
}
