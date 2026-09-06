"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

      <main className="min-h-screen bg-gray-50 p-4 md:p-8 no-print">
        <div className="mx-auto max-w-7xl">

          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Sick Notes
              </h1>

              <p className="mt-1 text-gray-600">
                Create and manage patient sick notes.
              </p>
            </div>

            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              + New Sick Note
            </button>
          </div>

          {showForm && (
            <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">

              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Create Sick Note
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Issue a sick note for an existing patient.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xl text-gray-400 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={createSickNote} className="space-y-6">

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Patient
                  </label>

                  <select
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
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
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    {(() => {
                      const patient = patients.find(
                        (p) => p.id === patientId
                      );

                      if (!patient) return null;

                      return (
                        <div className="grid gap-4 md:grid-cols-3">

                          <div>
                            <p className="text-xs text-gray-500">
                              Patient ID
                            </p>

                            <p className="font-semibold text-gray-900">
                              {patient.patient_id}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">
                              Patient
                            </p>

                            <p className="font-semibold text-gray-900">
                              {patient.first_name} {patient.last_name}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">
                              Phone
                            </p>

                            <p className="font-semibold text-gray-900">
                              {patient.phone || "—"}
                            </p>
                          </div>

                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="grid gap-5 md:grid-cols-3">

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Issue Date
                    </label>

                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Leave From
                    </label>

                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Leave To
                    </label>

                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3"
                      required
                    />
                  </div>

                </div>

                {startDate && endDate && (
                  <div className="rounded-lg bg-blue-50 p-4">
                    <span className="text-sm text-gray-600">
                      Sick leave duration:
                    </span>

                    <span className="ml-2 font-bold text-blue-700">
                      {calculateDays(startDate, endDate)} day(s)
                    </span>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Reason / Diagnosis
                  </label>

                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Not fit for work"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Additional Notes
                  </label>

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Additional information..."
                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">

                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Create Sick Note"}
                  </button>

                </div>

              </form>
            </section>
          )}

          <section className="rounded-xl bg-white shadow-sm">

            <div className="flex flex-col gap-4 border-b border-gray-200 p-6 md:flex-row md:items-center md:justify-between">

              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Sick Note History
                </h2>

                <p className="text-sm text-gray-500">
                  {sickNotes.length} sick note(s)
                </p>
              </div>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient or note..."
                className="w-full rounded-lg border border-gray-300 px-4 py-3 md:w-80"
              />

            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">
                Loading sick notes...
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {search
                  ? "No sick notes match your search."
                  : "No sick notes have been created yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full min-w-[1100px]">

                  <thead className="bg-gray-50">
                    <tr>

                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                        Note Number
                      </th>

                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                        Patient
                      </th>

                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                        Issue Date
                      </th>

                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                        Leave Period
                      </th>

                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                        Days
                      </th>

                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                        Reason
                      </th>

                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                        Actions
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">

                    {filteredNotes.map((note) => (
                      <tr
                        key={note.id}
                        className="hover:bg-gray-50"
                      >

                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {note.note_number || "—"}
                        </td>

                        <td className="px-6 py-4">

                          <div className="font-medium text-gray-900">
                            {note.patient
                              ? `${note.patient.first_name} ${note.patient.last_name}`
                              : "Unknown patient"}
                          </div>

                          <div className="text-sm text-gray-500">
                            {note.patient?.patient_id || note.patient_id}
                          </div>

                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatDate(note.issue_date)}
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatDate(note.start_date)} →{" "}
                          {formatDate(note.end_date)}
                        </td>

                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {calculateDays(
                            note.start_date,
                            note.end_date
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">
                          {note.reason || "—"}
                        </td>

                        <td className="px-6 py-4">

                          <div className="flex flex-wrap gap-2">

                            <button
                              onClick={() => setSelectedNote(note)}
                              className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                            >
                              View
                            </button>

                            <button
                              onClick={() => printSickNote(note)}
                              className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                            >
                              Print
                            </button>

                            <button
                              onClick={() => deleteSickNote(note.id)}
                              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
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

            <div className="mb-4 flex justify-end gap-2 no-print">

              <button
                onClick={() => printSickNote(selectedNote)}
                className="rounded-lg bg-green-600 px-5 py-3 font-semibold text-white"
              >
                Print
              </button>

              <button
                onClick={() => setSelectedNote(null)}
                className="rounded-lg bg-white px-5 py-3 font-semibold text-gray-700"
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

                  </div>

                </div>

              </div>

              <div className="mt-8">

                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
                  Patient Information
                </h3>

                <div className="grid gap-4 rounded-lg border border-gray-200 p-5 sm:grid-cols-2">

                  <div>
                    <p className="text-xs text-gray-500">
                      Patient Name
                    </p>

                    <p className="font-semibold text-gray-900">
                      {selectedNote.patient
                        ? `${selectedNote.patient.first_name} ${selectedNote.patient.last_name}`
                        : "Unknown patient"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Patient ID
                    </p>

                    <p className="font-semibold text-gray-900">
                      {selectedNote.patient?.patient_id ||
                        selectedNote.patient_id}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Phone
                    </p>

                    <p className="font-semibold text-gray-900">
                      {selectedNote.patient?.phone || "—"}
                    </p>
                  </div>

                  {selectedNote.patient?.id_number && (
                    <div>
                      <p className="text-xs text-gray-500">
                        ID Number
                      </p>

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
                    <p className="text-xs text-gray-500">
                      Leave From
                    </p>

                    <p className="font-semibold text-gray-900">
                      {formatDate(selectedNote.start_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Leave To
                    </p>

                    <p className="font-semibold text-gray-900">
                      {formatDate(selectedNote.end_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Total Days
                    </p>

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
