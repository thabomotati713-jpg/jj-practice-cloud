"use client";

import { useEffect, useState } from "react";
import { logAudit } from "@/lib/audit";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email?: string | null;
  id_number?: string | null;
};

type PracticeSettings = {
  practice_name: string;
  practice_code: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  country: string;
  postal_code: string;
  logo_url: string;
};

type SickNote = {
  id: string;
  practice_id: string;
  patient_id: string;
  note_number: string | null;
  issue_date: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  patient?: Patient;
};

const emptySettings: PracticeSettings = {
  practice_name: "",
  practice_code: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  province: "",
  country: "",
  postal_code: "",
  logo_url: "",
};

export default function SickNotesPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sickNotes, setSickNotes] = useState<SickNote[]>([]);
  const [practiceSettings, setPracticeSettings] =
    useState<PracticeSettings>(emptySettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState<SickNote | null>(null);
  const [verifyQr, setVerifyQr] = useState("");

  const [patientId, setPatientId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];

    setIssueDate(today);
    setStartDate(today);

    const params = new URLSearchParams(window.location.search);
    const requestedPatientId = params.get("patient_id");

    if (requestedPatientId) {
      setPatientId(requestedPatientId);
    }

    loadData();
  }, []);

  // Generate a QR code linking to the public verification page for the
  // currently selected note, so printed notes can be authenticated.
  useEffect(() => {
    if (!selectedNote?.id) {
      setVerifyQr("");
      return;
    }

    const url = `${window.location.origin}/verify/${selectedNote.id}`;

    QRCode.toDataURL(url, {
      width: 220,
      margin: 1,
      color: { dark: "#0f1f2d", light: "#ffffff" },
    })
      .then(setVerifyQr)
      .catch(() => setVerifyQr(""));
  }, [selectedNote?.id]);

  async function loadData() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile?.practice_id) {
      console.error("Profile error:", profileError);
      setLoading(false);
      return;
    }

    const practiceId = profile.practice_id;

    const [
      patientsResult,
      notesResult,
      settingsResult,
    ] = await Promise.all([
      supabase
        .from("patients")
        .select(
          "id, patient_id, first_name, last_name, phone, email, id_number"
        )
        .eq("practice_id", practiceId)
        .order("first_name", { ascending: true }),

      supabase
        .from("sick_notes")
        .select(
          "id, practice_id, patient_id, note_number, issue_date, start_date, end_date, reason, notes, created_at"
        )
        .eq("practice_id", practiceId)
        .order("created_at", { ascending: false }),

      supabase
        .from("practice_settings")
        .select("setting_key, setting_value")
        .eq("practice_id", practiceId),
    ]);

    if (patientsResult.error) {
      console.error("Patients error:", patientsResult.error);
    }

    if (notesResult.error) {
      console.error("Sick notes error:", notesResult.error);
    }

    if (settingsResult.error) {
      console.error("Practice settings error:", settingsResult.error);
    }

    const patientList = patientsResult.data || [];

    setPatients(patientList);

    const formattedNotes = (notesResult.data || []).map((note) => ({
      ...note,
      patient: patientList.find(
        (patient) => patient.id === note.patient_id
      ),
    }));

    setSickNotes(formattedNotes);

    // POPIA: sick note access is always logged.
    logAudit("view", "sick_note", null, "Sick notes list viewed");

    const loadedSettings = { ...emptySettings };

    for (const row of settingsResult.data || []) {
      if (row.setting_key in loadedSettings) {
        loadedSettings[
          row.setting_key as keyof PracticeSettings
        ] = row.setting_value || "";
      }
    }

    setPracticeSettings(loadedSettings);
    setLoading(false);
  }

  function resetForm() {
    const today = new Date().toISOString().split("T")[0];

    setPatientId("");
    setIssueDate(today);
    setStartDate(today);
    setEndDate("");
    setReason("");
    setNotes("");
  }

  function calculateDays(start: string, end: string) {
    if (!start || !end) return 0;

    const startTime = new Date(`${start}T00:00:00`).getTime();
    const endTime = new Date(`${end}T00:00:00`).getTime();

    if (endTime < startTime) return 0;

    return Math.floor((endTime - startTime) / 86400000) + 1;
  }

  function formatDate(date: string) {
    if (!date) return "—";

    const parsed = new Date(`${date}T00:00:00`);

    return parsed.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  async function createSickNote(e: React.FormEvent) {
    e.preventDefault();

    if (!patientId) {
      alert("Please select a patient.");
      return;
    }

    if (!issueDate || !startDate || !endDate) {
      alert("Please complete all required dates.");
      return;
    }

    if (endDate < startDate) {
      alert("The end date cannot be before the start date.");
      return;
    }

    setSaving(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        alert("Your session has expired. Please log in again.");
        window.location.href = "/";
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("practice_id")
        .eq("id", userData.user.id)
        .single();

      if (profileError || !profile?.practice_id) {
        alert("Could not determine your practice.");
        return;
      }

      const noteNumber = `SN-${Date.now()}`;

      const { error } = await supabase.from("sick_notes").insert({
        practice_id: profile.practice_id,
        patient_id: patientId,
        note_number: noteNumber,
        issue_date: issueDate,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
      });

      if (error) {
        console.error("Sick note insert error:", error);
        alert(`Could not create sick note: ${error.message}`);
        return;
      }

      alert("Sick note created successfully.");

      resetForm();
      setShowForm(false);

      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function deleteSickNote(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this sick note?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("sick_notes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      alert(`Could not delete sick note: ${error.message}`);
      return;
    }

    if (selectedNote?.id === id) {
      setSelectedNote(null);
    }

    await loadData();
  }

  function printSickNote(note: SickNote) {
    setSelectedNote(note);

    setTimeout(() => {
      window.print();
    }, 300);
  }

  const filteredNotes = sickNotes.filter((note) => {
    if (patientId && note.patient_id !== patientId) {
      return false;
    }

    const text = [
      note.note_number,
      note.reason,
      note.patient?.patient_id,
      note.patient?.first_name,
      note.patient?.last_name,
      note.patient?.phone,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          body * {
            visibility: hidden;
          }

          .sick-note-print,
          .sick-note-print * {
            visibility: visible;
          }

          .sick-note-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            box-shadow: none !important;
          }

          .no-print {
            display: none !important;
          }

          @page {
            size: A4;
            margin: 15mm;
          }
        }
      `}</style>

      <main className="page-shell">
        <header className="app-header no-print">
          <div className="app-header-inner">
            <a href="/dashboard" className="app-brand">
              <img
                src="/logo.jpg"
                alt="J&J Practice Cloud"
                className="app-brand-logo"
              />
              <span className="app-brand-name">J&J Practice Cloud</span>
            </a>
          </div>
        </header>

        <div className="page-inner no-print">
          <div className="page-header">
            <div>
              <h1 className="page-title">Sick Notes</h1>
              <p className="page-subtitle">
                Create and manage patient sick notes.
              </p>
            </div>
            <div className="page-actions">
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="btn btn-primary"
              >
                + New Sick Note
              </button>
            </div>
          </div>

          {showForm && (
            <section className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Create Sick Note</h2>
                  <p className="page-subtitle">
                    Issue a sick note for an existing patient.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn btn-secondary btn-sm"
                >
                  ✕
                </button>
              </div>

              <div className="card-body">
                <form onSubmit={createSickNote}>
                  <div className="field">
                    <label className="label" htmlFor="sick-note-patient">
                      Patient
                    </label>
                    <select
                      id="sick-note-patient"
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                      className="input"
                      required
                    >
                      <option value="">Select patient</option>

                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.patient_id} — {patient.first_name}{" "}
                          {patient.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {patientId && (
                    <div className="card">
                      <div className="card-body">
                        {(() => {
                          const patient = patients.find(
                            (p) => p.id === patientId
                          );

                          if (!patient) return null;

                          return (
                            <div className="grid gap-4 md:grid-cols-3">
                              <div>
                                <p className="stat-label">Patient ID</p>
                                <p className="stat-value">
                                  {patient.patient_id}
                                </p>
                              </div>

                              <div>
                                <p className="stat-label">Patient</p>
                                <p className="stat-value">
                                  {patient.first_name} {patient.last_name}
                                </p>
                              </div>

                              <div>
                                <p className="stat-label">Phone</p>
                                <p className="stat-value">
                                  {patient.phone || "—"}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-5 md:grid-cols-3">
                    <div className="field">
                      <label
                        className="label"
                        htmlFor="sick-note-issue-date"
                      >
                        Issue Date
                      </label>
                      <input
                        id="sick-note-issue-date"
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        className="input"
                        required
                      />
                    </div>

                    <div className="field">
                      <label
                        className="label"
                        htmlFor="sick-note-start-date"
                      >
                        Leave From
                      </label>
                      <input
                        id="sick-note-start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="input"
                        required
                      />
                    </div>

                    <div className="field">
                      <label className="label" htmlFor="sick-note-end-date">
                        Leave To
                      </label>
                      <input
                        id="sick-note-end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="input"
                        required
                      />
                    </div>
                  </div>

                  {startDate && endDate && (
                    <div className="alert-info">
                      <span>
                        Sick leave duration:{" "}
                        <strong>
                          {calculateDays(startDate, endDate)} day(s)
                        </strong>
                      </span>
                    </div>
                  )}

                  <div className="field">
                    <label className="label" htmlFor="sick-note-reason">
                      Reason / Diagnosis
                    </label>
                    <input
                      id="sick-note-reason"
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Not fit for work"
                      className="input"
                    />
                  </div>

                  <div className="field">
                    <label className="label" htmlFor="sick-note-notes">
                      Additional Notes
                    </label>
                    <textarea
                      id="sick-note-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Additional information..."
                      className="input"
                    />
                  </div>

                  <div className="page-actions justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary"
                    >
                      {saving ? "Saving..." : "Create Sick Note"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Sick Note History</h2>
                <p className="page-subtitle">
                  {sickNotes.length} sick note(s)
                </p>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient or note..."
                className="input md:w-80"
              />
            </div>

            {loading ? (
              <div className="empty-state">Loading sick notes...</div>
            ) : filteredNotes.length === 0 ? (
              <div className="empty-state">
                {search
                  ? "No sick notes match your search."
                  : "No sick notes have been created yet."}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table min-w-[1100px]">
                  <thead>
                    <tr>
                      <th>Note Number</th>
                      <th>Patient</th>
                      <th>Issue Date</th>
                      <th>Leave Period</th>
                      <th>Days</th>
                      <th>Reason</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredNotes.map((note) => (
                      <tr key={note.id}>
                        <td className="font-semibold">
                          {note.note_number || "—"}
                        </td>

                        <td>
                          <div className="font-medium">
                            {note.patient
                              ? `${note.patient.first_name} ${note.patient.last_name}`
                              : "Unknown patient"}
                          </div>
                          <div className="text-sm text-muted">
                            {note.patient?.patient_id || note.patient_id}
                          </div>
                        </td>

                        <td>{formatDate(note.issue_date)}</td>

                        <td>
                          {formatDate(note.start_date)} →{" "}
                          {formatDate(note.end_date)}
                        </td>

                        <td className="font-semibold">
                          {calculateDays(
                            note.start_date,
                            note.end_date
                          )}
                        </td>

                        <td>{note.reason || "—"}</td>

                        <td>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setSelectedNote(note)}
                              className="btn btn-secondary btn-sm"
                            >
                              View
                            </button>

                            <button
                              onClick={() => printSickNote(note)}
                              className="btn btn-primary btn-sm"
                            >
                              Print
                            </button>

                            <button
                              onClick={() => deleteSickNote(note.id)}
                              className="btn btn-danger btn-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {selectedNote && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto max-w-3xl">
            <div className="page-actions justify-end py-4 no-print">
              <button
                onClick={() => printSickNote(selectedNote)}
                className="btn btn-primary"
              >
                Print
              </button>

              <button
                onClick={() => setSelectedNote(null)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>

            <article className="sick-note-print rounded-xl bg-white p-8 shadow-xl md:p-12">
              <div className="border-b-2 border-gray-900 pb-6">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    {practiceSettings.logo_url && (
                      <img
                        src={practiceSettings.logo_url}
                        alt="Practice logo"
                        className="mb-4 max-h-24 max-w-[240px] object-contain"
                      />
                    )}

                    <h1 className="text-2xl font-bold text-gray-900">
                      {practiceSettings.practice_name ||
                        "Medical Practice"}
                    </h1>

                    {practiceSettings.practice_code && (
                      <p className="text-sm text-gray-600">
                        Practice Code: {practiceSettings.practice_code}
                      </p>
                    )}

                    <div className="mt-2 text-sm text-gray-600">
                      {practiceSettings.address && (
                        <div>{practiceSettings.address}</div>
                      )}

                      {(practiceSettings.city ||
                        practiceSettings.province ||
                        practiceSettings.postal_code) && (
                        <div>
                          {[
                            practiceSettings.city,
                            practiceSettings.province,
                            practiceSettings.postal_code,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}

                      {practiceSettings.country && (
                        <div>{practiceSettings.country}</div>
                      )}

                      {practiceSettings.phone && (
                        <div>Tel: {practiceSettings.phone}</div>
                      )}

                      {practiceSettings.email && (
                        <div>Email: {practiceSettings.email}</div>
                      )}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <h2 className="text-3xl font-bold tracking-wide text-gray-900">
                      SICK NOTE
                    </h2>

                    <p className="mt-2 text-sm text-gray-600">
                      Note Number
                    </p>

                    <p className="font-bold text-gray-900">
                      {selectedNote.note_number || "—"}
                    </p>

                    <p className="mt-2 text-sm text-gray-600">
                      Issue Date
                    </p>

                    <p className="font-semibold text-gray-900">
                      {formatDate(selectedNote.issue_date)}
                    </p>

                    {verifyQr && (
                      <div className="mt-4 flex flex-col items-center sm:items-end">
                        <img
                          src={verifyQr}
                          alt="Scan to verify this sick note"
                          className="h-24 w-24"
                        />

                        <p className="mt-1 text-[10px] leading-tight text-gray-500">
                          Scan to verify
                          <br />
                          authenticity
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
                  Patient Information
                </h3>

                <div className="grid gap-4 rounded-lg border border-gray-200 p-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500">Patient Name</p>
                    <p className="font-semibold text-gray-900">
                      {selectedNote.patient
                        ? `${selectedNote.patient.first_name} ${selectedNote.patient.last_name}`
                        : "Unknown patient"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Patient ID</p>
                    <p className="font-semibold text-gray-900">
                      {selectedNote.patient?.patient_id ||
                        selectedNote.patient_id}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="font-semibold text-gray-900">
                      {selectedNote.patient?.phone || "—"}
                    </p>
                  </div>

                  {selectedNote.patient?.id_number && (
                    <div>
                      <p className="text-xs text-gray-500">ID Number</p>
                      <p className="font-semibold text-gray-900">
                        {selectedNote.patient.id_number}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
                  Medical Leave
                </h3>

                <div className="grid gap-5 rounded-lg border border-gray-200 p-5 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-gray-500">Leave From</p>
                    <p className="font-semibold text-gray-900">
                      {formatDate(selectedNote.start_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Leave To</p>
                    <p className="font-semibold text-gray-900">
                      {formatDate(selectedNote.end_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Total Days</p>
                    <p className="font-bold text-gray-900">
                      {calculateDays(
                        selectedNote.start_date,
                        selectedNote.end_date
                      )}{" "}
                      day(s)
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
                  Reason / Diagnosis
                </h3>

                <div className="min-h-[90px] rounded-lg border border-gray-200 p-5 text-gray-800">
                  {selectedNote.reason || "Not specified"}
                </div>
              </div>

              {selectedNote.notes && (
                <div className="mt-8">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
                    Additional Notes
                  </h3>

                  <div className="min-h-[80px] rounded-lg border border-gray-200 p-5 whitespace-pre-wrap text-gray-800">
                    {selectedNote.notes}
                  </div>
                </div>
              )}

              <div className="mt-16 grid gap-12 sm:grid-cols-2">
                <div>
                  <div className="border-b border-gray-900 pb-2" />
                  <p className="mt-2 text-sm font-medium text-gray-700">
                    Healthcare Provider Signature
                  </p>
                </div>

                <div>
                  <div className="border-b border-gray-900 pb-2" />
                  <p className="mt-2 text-sm font-medium text-gray-700">
                    Date
                  </p>
                </div>
              </div>

              <div className="mt-12 border-t pt-4 text-center text-xs text-gray-500">
                This document was generated by J&J PRACTICE CLOUD.
              </div>
            </article>
          </div>
        </div>
      )}
    </>
  );
}
