"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Appointment = {
  id: string;
  patient_id: string;
  provider_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string | null;
  appointment_type: string | null;
  reason: string | null;
  status: string | null;
  notes: string | null;
};

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

export default function EditAppointmentPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = params.id as string;

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    appointment_date: "",
    start_time: "",
    end_time: "",
    appointment_type: "",
    reason: "",
    status: "scheduled",
    notes: "",
  });

  useEffect(() => {
    loadAppointment();
  }, [appointmentId]);

  async function loadAppointment() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.practice_id) {
      setError("Unable to determine practice.");
      setLoading(false);
      return;
    }

    const { data, error: appointmentError } = await supabase
      .from("appointments")
      .select(
        "id, patient_id, provider_id, appointment_date, start_time, end_time, appointment_type, reason, status, notes"
      )
      .eq("id", appointmentId)
      .eq("practice_id", profile.practice_id)
      .single();

    if (appointmentError || !data) {
      setError("Appointment not found.");
      setLoading(false);
      return;
    }

    const appointmentData = data as Appointment;

    const { data: patientData } = await supabase
      .from("patients")
      .select("id, patient_id, first_name, middle_name, last_name")
      .eq("id", appointmentData.patient_id)
      .eq("practice_id", profile.practice_id)
      .single();

    setAppointment(appointmentData);
    setPatient(patientData as Patient | null);

    setForm({
      appointment_date: appointmentData.appointment_date || "",
      start_time: appointmentData.start_time || "",
      end_time: appointmentData.end_time || "",
      appointment_type: appointmentData.appointment_type || "",
      reason: appointmentData.reason || "",
      status: appointmentData.status || "scheduled",
      notes: appointmentData.notes || "",
    });

    setLoading(false);
  }

  function updateField(field: string, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.practice_id) {
      setError("Unable to determine practice.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        appointment_date: form.appointment_date,
        start_time: form.start_time,
        end_time: form.end_time || null,
        appointment_type: form.appointment_type || null,
        reason: form.reason || null,
        status: form.status || "scheduled",
        notes: form.notes || null,
      })
      .eq("id", appointmentId)
      .eq("practice_id", profile.practice_id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setMessage("Appointment updated successfully.");
    setSaving(false);

    setTimeout(() => {
      router.push("/appointments");
    }, 800);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-slate-600">Loading appointment...</p>
        </div>
      </main>
    );
  }

  if (!appointment) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-red-600">{error || "Appointment not found."}</p>
            <button
              onClick={() => router.push("/appointments")}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Back to Appointments
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push("/appointments")}
              className="mb-2 text-sm text-blue-600 hover:underline"
            >
              ← Back to Appointments
            </button>

            <h1 className="text-2xl font-bold text-slate-900">
              Edit Appointment
            </h1>

            {patient && (
              <p className="mt-1 text-sm text-slate-600">
                {patient.patient_id} — {patient.first_name}{" "}
                {patient.middle_name ? `${patient.middle_name} ` : ""}
                {patient.last_name}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          {message && (
            <div className="mb-5 rounded-lg bg-green-50 p-4 text-sm text-green-700">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Appointment Date
                </label>
                <input
                  type="date"
                  value={form.appointment_date}
                  onChange={(e) =>
                    updateField("appointment_date", e.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Appointment Type
                </label>
                <select
                  value={form.appointment_type}
                  onChange={(e) =>
                    updateField("appointment_type", e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select type</option>
                  <option value="Consultation">Consultation</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Procedure">Procedure</option>
                  <option value="Review">Review</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Start Time
                </label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => updateField("start_time", e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  End Time
                </label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => updateField("end_time", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Reason
                </label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => updateField("reason", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Reason for appointment"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Appointment notes"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => router.push("/appointments")}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
