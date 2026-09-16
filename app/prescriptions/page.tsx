"use client";

import { useEffect, useState } from "react";
import { logAudit } from "@/lib/audit";
import { supabase } from "../../lib/supabase";

type Prescription = {
  id: string;
  patient_id: string;
  provider_id: string;
  prescription_number: string | null;
  prescription_date: string;
  notes: string | null;
  status: string | null;
};

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type PrescriptionItem = {
  prescription_id: string;
  medicine_name: string;
  strength: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number | null;
  route: string | null;
  instructions: string | null;
};

const statusBadgeClass = (status: string) => {
  const value = status.toLowerCase();

  if (
    value === "paid" ||
    value === "completed" ||
    value === "active" ||
    value === "in stock"
  ) {
    return "badge badge-green";
  }

  if (
    value === "pending" ||
    value === "submitted" ||
    value === "partially paid" ||
    value === "scheduled" ||
    value === "confirmed"
  ) {
    return "badge badge-blue";
  }

  if (value === "low stock" || value === "no show") {
    return "badge badge-amber";
  }

  if (
    value === "cancelled" ||
    value === "canceled" ||
    value === "rejected" ||
    value === "overdue" ||
    value === "out of stock"
  ) {
    return "badge badge-red";
  }

  return "badge badge-gray";
};

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPrescriptions();
  }, []);

  const loadPrescriptions = async () => {
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

    if (profileError || !profile) {
      setError("Your practice profile could not be found.");
      setLoading(false);
      return;
    }

    const practiceId = profile.practice_id;

    const { data: patientData, error: patientError } = await supabase
      .from("patients")
      .select("id, patient_id, first_name, middle_name, last_name")
      .eq("practice_id", practiceId)
      .order("last_name", { ascending: true });

    if (patientError) {
      setError(patientError.message);
      setLoading(false);
      return;
    }

    setPatients((patientData || []) as Patient[]);

    const { data: prescriptionData, error: prescriptionError } =
      await supabase
        .from("prescriptions")
        .select(
          "id, patient_id, provider_id, prescription_number, prescription_date, notes, status"
        )
        .eq("practice_id", practiceId)
        .order("prescription_date", { ascending: false });

    if (prescriptionError) {
      setError(prescriptionError.message);
      setLoading(false);
      return;
    }

    setPrescriptions((prescriptionData || []) as Prescription[]);

    // POPIA: prescription access is always logged.
    logAudit("view", "prescription", null, "Prescriptions list viewed");

    if (prescriptionData && prescriptionData.length > 0) {
      const prescriptionIds = prescriptionData.map(
        (prescription) => prescription.id
      );

      const { data: itemData, error: itemError } = await supabase
        .from("prescription_items")
        .select(
          "prescription_id, medicine_name, strength, dosage, frequency, duration, quantity, route, instructions"
        )
        .in("prescription_id", prescriptionIds);

      if (itemError) {
        setError(itemError.message);
      } else {
        setItems((itemData || []) as PrescriptionItem[]);
      }
    }

    setLoading(false);
  };

  const getPatient = (id: string) => {
    return patients.find((patient) => patient.id === id);
  };

  const getItems = (prescriptionId: string) => {
    return items.filter(
      (item) => item.prescription_id === prescriptionId
    );
  };

  const formatName = (patient: Patient) => {
    return [
      patient.first_name,
      patient.middle_name,
      patient.last_name,
    ]
      .filter(Boolean)
      .join(" ");
  };

  const formatDate = (date: string) => {
    const value = new Date(date);

    if (Number.isNaN(value.getTime())) {
      return date;
    }

    return value.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          <div className="empty-state">
            Loading prescriptions...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <a href="/dashboard" className="app-brand">
            <img
              src="/logo.jpg"
              alt="J&J Practice Cloud"
              className="app-brand-logo"
            />
            <span className="app-brand-name">J&J Practice Cloud</span>
          </a>

          <div className="page-actions">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              className="btn btn-secondary btn-sm"
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="btn btn-secondary btn-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Prescriptions</h1>

            <p className="page-subtitle">
              Manage prescriptions for your practice.
            </p>
          </div>

          <div className="page-actions">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/patients";
              }}
              className="btn btn-primary"
            >
              New Prescription
            </button>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Prescription List</h3>

            <p className="page-subtitle">
              {prescriptions.length} prescription
              {prescriptions.length === 1 ? "" : "s"}
            </p>
          </div>

          {prescriptions.length === 0 ? (
            <div className="empty-state">
              <p className="font-medium text-slate-700">
                No prescriptions found
              </p>

              <p className="mt-1">
                Prescriptions you create will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {prescriptions.map((prescription) => {
                const patient = getPatient(prescription.patient_id);
                const prescriptionItems = getItems(prescription.id);

                return (
                  <div
                    key={prescription.id}
                    className="p-6 transition hover:bg-slate-50"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        {patient ? (
                          <button
                            type="button"
                            onClick={() => {
                              window.location.href = `/patients/${patient.id}`;
                            }}
                            className="text-left"
                          >
                            <p className="text-sm font-semibold text-slate-500">
                              {patient.patient_id}
                            </p>

                            <h4 className="mt-1 text-lg font-semibold text-slate-900">
                              {formatName(patient)}
                            </h4>
                          </button>
                        ) : (
                          <p className="font-semibold text-slate-900">
                            Patient unavailable
                          </p>
                        )}

                        <p className="mt-2 text-sm text-slate-500">
                          Prescription:{" "}
                          {prescription.prescription_number ||
                            "Not numbered"}
                        </p>

                        <p className="text-sm text-slate-500">
                          Date:{" "}
                          {formatDate(
                            prescription.prescription_date
                          )}
                        </p>
                      </div>

                      <span
                        className={statusBadgeClass(
                          (prescription.status || "active").replace(
                            "_",
                            " "
                          )
                        )}
                      >
                        {(prescription.status || "active").replace(
                          "_",
                          " "
                        )}
                      </span>
                    </div>

                    {prescriptionItems.length > 0 && (
                      <div className="mt-5 rounded-xl bg-slate-50 p-4">
                        <p className="stat-label mb-3">
                          Medication
                        </p>

                        <div className="space-y-3">
                          {prescriptionItems.map((item, index) => (
                            <div
                              key={`${prescription.id}-${index}`}
                              className="rounded-xl border border-slate-200 bg-white p-4"
                            >
                              <p className="font-semibold text-slate-900">
                                {item.medicine_name}
                                {item.strength
                                  ? ` ${item.strength}`
                                  : ""}
                              </p>

                              <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                                {item.dosage && (
                                  <p>
                                    <strong>Dosage:</strong>{" "}
                                    {item.dosage}
                                  </p>
                                )}

                                {item.frequency && (
                                  <p>
                                    <strong>Frequency:</strong>{" "}
                                    {item.frequency}
                                  </p>
                                )}

                                {item.duration && (
                                  <p>
                                    <strong>Duration:</strong>{" "}
                                    {item.duration}
                                  </p>
                                )}

                                {item.quantity !== null && (
                                  <p>
                                    <strong>Quantity:</strong>{" "}
                                    {item.quantity}
                                  </p>
                                )}

                                {item.route && (
                                  <p>
                                    <strong>Route:</strong>{" "}
                                    {item.route}
                                  </p>
                                )}
                              </div>

                              {item.instructions && (
                                <p className="mt-2 text-sm text-slate-600">
                                  <strong>Instructions:</strong>{" "}
                                  {item.instructions}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {prescription.notes && (
                      <div className="mt-4">
                        <p className="stat-label">Notes</p>

                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {prescription.notes}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
