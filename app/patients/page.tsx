"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PracticeAccessGuard from "../../components/PracticeAccessGuard";

type Patient = {
  id: string;
  patient_id: string;
  title: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    setError("");

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      window.location.href = "/";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      setError("Your practice profile could not be found.");
      setLoading(false);
      return;
    }

    const { data, error: patientsError } = await supabase
      .from("patients")
      .select(
        "id, patient_id, title, first_name, middle_name, last_name, date_of_birth, gender, phone, email, status"
      )
      .eq("practice_id", profile.practice_id)
      .order("created_at", { ascending: false });

    if (patientsError) {
      setError(patientsError.message);
    } else {
      setPatients((data || []) as Patient[]);
    }

    setLoading(false);
  };

  const filteredPatients = patients.filter((patient) => {
    const text = [
      patient.patient_id,
      patient.first_name,
      patient.middle_name,
      patient.last_name,
      patient.phone,
      patient.email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <PracticeAccessGuard>
    <main className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              J&J PRACTICE CLOUD
            </h1>

            <p className="text-sm text-slate-500">
              Practice Management System
            </p>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              className="mb-3 text-sm font-semibold text-blue-700 hover:text-blue-800"
            >
              ← Dashboard
            </button>

            <h2 className="text-3xl font-bold text-slate-900">
              Patients
            </h2>

            <p className="mt-1 text-slate-500">
              Manage your practice patients
            </p>
          </div>

          <button
            onClick={() => {
              window.location.href = "/patients/new";
            }}
            className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            + Add Patient
          </button>
        </div>

        {/* Search */}
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <label
            htmlFor="patient-search"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Search patients
          </label>

          <input
            id="patient-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient ID, name, phone or email..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Patient Table */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Patient ID
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Name
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date of Birth
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Gender
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Phone
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-sm text-slate-500"
                    >
                      Loading patients...
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-sm text-slate-500"
                    >
                      {search
                        ? "No patients match your search."
                        : "No patients found."}
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => (
                    <tr
                      key={patient.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            window.location.href = `/patients/${patient.id}`;
                          }}
                          className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                        >
                          {patient.patient_id}
                        </button>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">
                          {[
                            patient.title,
                            patient.first_name,
                            patient.middle_name,
                            patient.last_name,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {patient.date_of_birth || "—"}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {patient.gender || "—"}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {patient.phone || "—"}
                      </td>

                      <td className="px-6 py-4">
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                          {patient.status || "active"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
    </PracticeAccessGuard>
  );
}
