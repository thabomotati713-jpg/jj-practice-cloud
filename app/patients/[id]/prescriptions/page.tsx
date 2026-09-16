"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  date_of_birth: string | null;
};

type Provider = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

type Consultation = {
  id: string;
  consultation_date: string;
  chief_complaint: string | null;
  diagnosis: string | null;
};

type Prescription = {
  id: string;
  prescription_number: string;
  prescription_date: string;
  notes: string | null;
  status: string | null;
  provider_id: string | null;
  consultation_id: string | null;
  provider?: Provider | null;
  consultation?: Consultation | null;
};

type PrescriptionItem = {
  id: string;
  prescription_id: string;
  medicine_name: string;
  strength: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number | null;
  route: string | null;
  instructions: string | null;
  inventory_product_id: string | null;
};

type PrescriptionDispense = {
  id: string;
  prescription_item_id: string;
  inventory_product_id: string;
  quantity: number;
  dispensed_at: string;
};

type PrescriptionWithItems = Prescription & {
  items: PrescriptionItem[];
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

export default function PatientPrescriptionsPage() {
  const params = useParams();
  const router = useRouter();

  const patientId = String(params.id);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [prescriptions, setPrescriptions] = useState<
    PrescriptionWithItems[]
  >([]);
  const [practiceSettings, setPracticeSettings] =
    useState<PracticeSettings>(emptySettings);

  const [dispenses, setDispenses] = useState<PrescriptionDispense[]>([]);
  const [dispensingItemId, setDispensingItemId] = useState<string | null>(null);
  const [dispenseQuantity, setDispenseQuantity] = useState("1");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, [patientId]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("practice_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.practice_id) {
        setMessage("Unable to determine the practice.");
        setLoading(false);
        return;
      }

      const practiceId = profile.practice_id;

      const [
        { data: patientData, error: patientError },
        { data: prescriptionData, error: prescriptionError },
        { data: settingsData, error: settingsError },
      ] = await Promise.all([
        supabase
          .from("patients")
          .select(
            "id, patient_id, first_name, middle_name, last_name, phone, email, id_number, date_of_birth"
          )
          .eq("id", patientId)
          .eq("practice_id", practiceId)
          .single(),

        supabase
          .from("prescriptions")
          .select(
            `
            id,
            prescription_number,
            prescription_date,
            notes,
            status,
            provider_id,
            consultation_id,
            provider:profiles!prescriptions_provider_id_fkey(
              id,
              first_name,
              last_name,
              display_name
            ),
            consultation:consultations!prescriptions_consultation_id_fkey(
              id,
              consultation_date,
              chief_complaint,
              diagnosis
            )
          `
          )
          .eq("patient_id", patientId)
          .eq("practice_id", practiceId)
          .order("prescription_date", { ascending: false }),

        supabase
          .from("practice_settings")
          .select("setting_key, setting_value")
          .eq("practice_id", practiceId),
      ]);

      if (patientError || !patientData) {
        setMessage("Patient not found.");
        setLoading(false);
        return;
      }

      if (prescriptionError) {
        setMessage(prescriptionError.message);
        setLoading(false);
        return;
      }

      setPatient(patientData);

      if (settingsError) {
        console.error("Practice settings error:", settingsError);
      }

      const mappedSettings: PracticeSettings = { ...emptySettings };

      (settingsData || []).forEach((row: any) => {
        const key = row.setting_key as keyof PracticeSettings;

        if (key in mappedSettings) {
          mappedSettings[key] = row.setting_value || "";
        }
      });

      setPracticeSettings(mappedSettings);

      const prescriptionIds = (prescriptionData || []).map(
        (prescription) => prescription.id
      );

      let itemData: PrescriptionItem[] = [];

      if (prescriptionIds.length > 0) {
        const { data: items, error: itemError } = await supabase
          .from("prescription_items")
          .select(
            "id, prescription_id, medicine_name, strength, dosage, frequency, duration, quantity, route, instructions, inventory_product_id, created_at"
          )
          .in("prescription_id", prescriptionIds)
          .order("created_at", { ascending: true });

        if (itemError) {
          setMessage(itemError.message);
          setLoading(false);
          return;
        }

        itemData = items || [];
      }

      const prescriptionItemIds = itemData.map((item) => item.id);

      let dispenseData: PrescriptionDispense[] = [];

      if (prescriptionItemIds.length > 0) {
        const { data: dispenseRows, error: dispenseError } = await supabase
          .from("prescription_dispenses")
          .select(
            "id, prescription_item_id, inventory_product_id, quantity, dispensed_at"
          )
          .in("prescription_item_id", prescriptionItemIds)
          .order("dispensed_at", { ascending: true });

        if (dispenseError) {
          setMessage(dispenseError.message);
          setLoading(false);
          return;
        }

        dispenseData = (dispenseRows || []) as PrescriptionDispense[];
      }

      setDispenses(dispenseData);

      const combined: PrescriptionWithItems[] = (prescriptionData || []).map(
        (prescription: any) => ({
          ...prescription,
          provider: Array.isArray(prescription.provider)
            ? prescription.provider[0] || null
            : prescription.provider || null,
          consultation: Array.isArray(prescription.consultation)
            ? prescription.consultation[0] || null
            : prescription.consultation || null,
          items: itemData.filter(
            (item) => item.prescription_id === prescription.id
          ),
        })
      );

      setPrescriptions(combined);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load prescriptions."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredPrescriptions = useMemo(() => {
    const term = search.trim().toLowerCase();

    return prescriptions.filter((prescription) => {
      const status = (prescription.status || "").toLowerCase();

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      if (!term) {
        return true;
      }

      const providerName =
        prescription.provider?.display_name ||
        [
          prescription.provider?.first_name,
          prescription.provider?.last_name,
        ]
          .filter(Boolean)
          .join(" ");

      const medicineText = prescription.items
        .map((item) =>
          [
            item.medicine_name,
            item.strength,
            item.dosage,
            item.frequency,
            item.route,
          ]
            .filter(Boolean)
            .join(" ")
        )
        .join(" ");

      const consultationText = [
        prescription.consultation?.chief_complaint,
        prescription.consultation?.diagnosis,
      ]
        .filter(Boolean)
        .join(" ");

      return [
        prescription.prescription_number,
        prescription.notes,
        providerName,
        medicineText,
        consultationText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [prescriptions, search, statusFilter]);

  const activeCount = prescriptions.filter(
    (prescription) => (prescription.status || "").toLowerCase() === "active"
  ).length;

  const cancelledCount = prescriptions.filter((prescription) => {
    const status = (prescription.status || "").toLowerCase();
    return status === "cancelled" || status === "canceled";
  }).length;

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "—";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const providerName = (provider: Provider | null | undefined) => {
    if (!provider) return "Not recorded";

    return (
      provider.display_name ||
      [provider.first_name, provider.last_name].filter(Boolean).join(" ") ||
      "Not recorded"
    );
  };

  const statusLabel = (status: string | null) => {
    if (!status) return "Unknown";

    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const getDispensedQuantity = (itemId: string) => {
    return dispenses
      .filter((dispense) => dispense.prescription_item_id === itemId)
      .reduce((total, dispense) => total + Number(dispense.quantity || 0), 0);
  };

  const getRemainingQuantity = (item: PrescriptionItem) => {
    const prescribed = Number(item.quantity || 0);
    const dispensed = getDispensedQuantity(item.id);

    return Math.max(0, prescribed - dispensed);
  };

  const dispenseItem = async (item: PrescriptionItem) => {
    const quantity = Number(dispenseQuantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessage("Enter a valid dispensing quantity.");
      return;
    }

    const remaining = getRemainingQuantity(item);

    if (quantity > remaining) {
      setMessage(
        `Cannot dispense ${quantity}. Only ${remaining} remaining.`
      );
      return;
    }

    if (!item.inventory_product_id) {
      setMessage("This medication is not linked to an inventory product.");
      return;
    }

    try {
      setDispensingItemId(item.id);
      setMessage("");

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const { data, error } = await supabase.rpc(
        "dispense_prescription_item",
        {
          p_prescription_item_id: item.id,
          p_quantity: quantity,
          p_dispensed_by: userData.user?.id ?? null,
          p_notes: null,
        }
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("Dispensing failed: no dispense record was returned.");
      }

      setDispenseQuantity("1");
      setDispensingItemId(null);

      await loadData();

      setMessage(
        `${item.medicine_name} dispensed successfully.`
      );
    } catch (error) {
      console.error("Dispense error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to dispense medication."
      );

      setDispensingItemId(null);
    }
  };

  const statusBadgeClass = (status: string | null) => {
    const value = (status || "").toLowerCase();

    if (value === "active" || value === "completed") {
      return "badge badge-green";
    }

    if (value === "cancelled" || value === "canceled") {
      return "badge badge-red";
    }

    return "badge badge-gray";
  };

  function printPrescription(prescription: PrescriptionWithItems) {
    setPrintingId(prescription.id);

    setTimeout(() => {
      window.print();

      setTimeout(() => {
        setPrintingId(null);
      }, 500);
    }, 300);
  }

  const patientName = patient
    ? [patient.first_name, patient.middle_name, patient.last_name]
        .filter(Boolean)
        .join(" ")
    : "Patient";

  const printedPrescription = prescriptions.find(
    (prescription) => prescription.id === printingId
  );

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

          .prescription-print,
          .prescription-print * {
            visibility: visible;
          }

          .prescription-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            min-height: 100vh;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
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

      <main className="page-shell no-print">
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

            <button
              onClick={() => router.push(`/patients/${patientId}`)}
              className="btn btn-secondary btn-sm"
            >
              ← Back to Patient Profile
            </button>
          </div>
        </header>

        <div className="page-inner">
          <div className="page-header">
            <div>
              <h1 className="page-title">Prescription History</h1>

              {patient && (
                <p className="page-subtitle">
                  <span className="font-semibold">{patientName}</span>
                  <span className="mx-2">•</span>
                  Patient ID: {patient.patient_id}
                </p>
              )}
            </div>

            <div className="page-actions">
              <button
                onClick={() =>
                  router.push(`/patients/${patientId}/prescriptions/new`)
                }
                className="btn btn-primary"
              >
                + New Prescription
              </button>
            </div>
          </div>

          {message && <div className="alert-error">{message}</div>}

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Total Prescriptions</div>
              <div className="stat-value">{prescriptions.length}</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Active</div>
              <div className="stat-value">{activeCount}</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Cancelled</div>
              <div className="stat-value">{cancelledCount}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search prescription number, medicine, doctor, diagnosis..."
                  className="input"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="input md:max-w-xs"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="dispensed">Dispensed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card">
              <div className="empty-state">
                Loading prescription history...
              </div>
            </div>
          ) : filteredPrescriptions.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="text-lg font-semibold text-gray-800">
                  No prescriptions found
                </div>

                <p className="mt-2">
                  {prescriptions.length === 0
                    ? "This patient does not have any prescriptions yet."
                    : "No prescriptions match your current search or filter."}
                </p>

                {prescriptions.length === 0 && (
                  <button
                    onClick={() =>
                      router.push(`/patients/${patientId}/prescriptions/new`)
                    }
                    className="btn btn-primary mt-5"
                  >
                    Create First Prescription
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPrescriptions.map((prescription) => {
                const expanded = expandedId === prescription.id;

                return (
                  <div key={prescription.id} className="card">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(expanded ? null : prescription.id)
                      }
                      className="w-full p-5 text-left hover:bg-gray-50"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">
                              {prescription.prescription_number}
                            </span>

                            <span className={statusBadgeClass(prescription.status)}>
                              {statusLabel(prescription.status)}
                            </span>
                          </div>

                          <div className="mt-2 text-sm text-gray-600">
                            Date:{" "}
                            <span className="font-medium text-gray-800">
                              {formatDate(prescription.prescription_date)}
                            </span>
                          </div>

                          <div className="mt-1 text-sm text-gray-600">
                            Provider:{" "}
                            <span className="font-medium text-gray-800">
                              {providerName(prescription.provider)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              {prescription.items.length}{" "}
                              {prescription.items.length === 1
                                ? "medicine"
                                : "medicines"}
                            </div>

                            {prescription.consultation && (
                              <div className="mt-1 text-xs text-gray-500">
                                Linked consultation
                              </div>
                            )}
                          </div>

                          <span className="text-xl text-gray-400">
                            {expanded ? "▲" : "▼"}
                          </span>
                        </div>
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-gray-100 bg-gray-50 p-5">
                        {prescription.consultation && (
                          <div className="alert-info mb-5">
                            <div className="text-sm font-semibold">
                              Linked Consultation
                            </div>

                            <div className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                              <div>
                                <span className="font-semibold">Date:</span>{" "}
                                {formatDate(
                                  prescription.consultation.consultation_date
                                )}
                              </div>

                              <div>
                                <span className="font-semibold">
                                  Chief complaint:
                                </span>{" "}
                                {prescription.consultation.chief_complaint ||
                                  "—"}
                              </div>

                              <div>
                                <span className="font-semibold">
                                  Diagnosis:
                                </span>{" "}
                                {prescription.consultation.diagnosis || "—"}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          {prescription.items.length === 0 ? (
                            <div className="alert-error">
                              No medicine items were found for this
                              prescription.
                            </div>
                          ) : (
                            prescription.items.map((item, index) => (
                              <div
                                key={item.id}
                                className="rounded-xl border border-gray-200 bg-white p-4"
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <div className="text-base font-bold text-gray-900">
                                      {index + 1}. {item.medicine_name}
                                    </div>

                                    {item.strength && (
                                      <div className="mt-1 text-sm text-gray-600">
                                        Strength:{" "}
                                        <span className="font-medium text-gray-800">
                                          {item.strength}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {item.quantity !== null && (
                                    <span className="badge badge-gray">
                                      Qty: {item.quantity}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                  <div>
                                    <div className="stat-label">Dosage</div>
                                    <div className="mt-1 text-gray-800">
                                      {item.dosage || "—"}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="stat-label">Frequency</div>
                                    <div className="mt-1 text-gray-800">
                                      {item.frequency || "—"}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="stat-label">Duration</div>
                                    <div className="mt-1 text-gray-800">
                                      {item.duration || "—"}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="stat-label">Route</div>
                                    <div className="mt-1 text-gray-800">
                                      {item.route || "—"}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                                  <div className="flex flex-wrap items-center gap-4">
                                    <div>
                                      <div className="stat-label">
                                        Prescribed
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-gray-900">
                                        {item.quantity ?? 0}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="stat-label">
                                        Dispensed
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-gray-900">
                                        {getDispensedQuantity(item.id)}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="stat-label">
                                        Remaining
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-gray-900">
                                        {getRemainingQuantity(item)}
                                      </div>
                                    </div>

                                    {item.inventory_product_id ? (
                                      getRemainingQuantity(item) > 0 &&
                                      prescription.status === "active" ? (
                                        <div className="ml-auto flex flex-wrap items-end gap-2">
                                          <div>
                                            <label
                                              htmlFor={`dispense-${item.id}`}
                                              className="label text-xs"
                                            >
                                              Quantity to dispense
                                            </label>

                                            <input
                                              id={`dispense-${item.id}`}
                                              type="number"
                                              min="1"
                                              max={getRemainingQuantity(item)}
                                              step="1"
                                              value={
                                                dispensingItemId === item.id
                                                  ? dispenseQuantity
                                                  : "1"
                                              }
                                              onChange={(event) =>
                                                setDispenseQuantity(
                                                  event.target.value
                                                )
                                              }
                                              className="input w-28"
                                            />
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() => dispenseItem(item)}
                                            disabled={
                                              dispensingItemId === item.id
                                            }
                                            className="btn btn-primary btn-sm"
                                          >
                                            {dispensingItemId === item.id
                                              ? "Dispensing..."
                                              : "Dispense"}
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="badge badge-green ml-auto">
                                          Fully dispensed
                                        </span>
                                      )
                                    ) : (
                                      <span className="badge badge-amber ml-auto">
                                        Not linked to inventory
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {item.instructions && (
                                  <div className="mt-4 rounded-lg bg-gray-50 p-3">
                                    <div className="stat-label">
                                      Instructions
                                    </div>
                                    <div className="mt-1 text-sm text-gray-800">
                                      {item.instructions}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {prescription.notes && (
                          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                            <div className="stat-label">
                              Prescription Notes
                            </div>
                            <div className="mt-1 text-sm text-gray-800">
                              {prescription.notes}
                            </div>
                          </div>
                        )}

                        <div className="page-actions mt-5">
                          <button
                            type="button"
                            onClick={() => printPrescription(prescription)}
                            className="btn btn-secondary btn-sm"
                          >
                            🖨 Print Prescription
                          </button>

                          {prescription.consultation_id && (
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/patients/${patientId}/consultations`
                                )
                              }
                              className="btn btn-secondary btn-sm"
                            >
                              View Consultations
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/patients/${patientId}`)
                            }
                            className="btn btn-secondary btn-sm"
                          >
                            Patient Profile
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {printedPrescription && patient && (
        <div className="prescription-print hidden min-h-screen bg-white p-8 text-gray-900 md:p-12 print:block">
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

                <h1 className="text-2xl font-bold">
                  {practiceSettings.practice_name || "Medical Practice"}
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
                <h2 className="text-3xl font-bold tracking-wide">
                  PRESCRIPTION
                </h2>

                <div className="mt-3 text-sm">
                  <div>
                    <span className="font-semibold">Prescription No:</span>{" "}
                    {printedPrescription.prescription_number}
                  </div>

                  <div>
                    <span className="font-semibold">Date:</span>{" "}
                    {formatDate(printedPrescription.prescription_date)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="mt-6 border-b border-gray-300 pb-6">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">
              Patient Details
            </h3>

            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="font-semibold">Name:</span> {patientName}
              </div>

              <div>
                <span className="font-semibold">Patient ID:</span>{" "}
                {patient.patient_id}
              </div>

              {patient.date_of_birth && (
                <div>
                  <span className="font-semibold">Date of Birth:</span>{" "}
                  {formatDate(patient.date_of_birth)}
                </div>
              )}

              {patient.id_number && (
                <div>
                  <span className="font-semibold">ID Number:</span>{" "}
                  {patient.id_number}
                </div>
              )}

              {patient.phone && (
                <div>
                  <span className="font-semibold">Phone:</span> {patient.phone}
                </div>
              )}

              {patient.email && (
                <div>
                  <span className="font-semibold">Email:</span> {patient.email}
                </div>
              )}
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Medication</h3>

              <div className="text-sm">
                <span className="font-semibold">Prescriber:</span>{" "}
                {providerName(printedPrescription.provider)}
              </div>
            </div>

            {printedPrescription.consultation && (
              <div className="mb-5 rounded-lg border border-gray-300 p-3 text-sm">
                {printedPrescription.consultation.diagnosis && (
                  <div>
                    <span className="font-semibold">Diagnosis:</span>{" "}
                    {printedPrescription.consultation.diagnosis}
                  </div>
                )}

                {printedPrescription.consultation.chief_complaint && (
                  <div className="mt-1">
                    <span className="font-semibold">Chief Complaint:</span>{" "}
                    {printedPrescription.consultation.chief_complaint}
                  </div>
                )}
              </div>
            )}

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="px-2 py-3 text-left">Medicine</th>
                  <th className="px-2 py-3 text-left">Strength</th>
                  <th className="px-2 py-3 text-left">Dosage</th>
                  <th className="px-2 py-3 text-left">Frequency</th>
                  <th className="px-2 py-3 text-left">Duration</th>
                  <th className="px-2 py-3 text-left">Qty</th>
                  <th className="px-2 py-3 text-left">Route</th>
                </tr>
              </thead>

              <tbody>
                {printedPrescription.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-300">
                    <td className="px-2 py-3 font-semibold">
                      {item.medicine_name}
                    </td>
                    <td className="px-2 py-3">{item.strength || "—"}</td>
                    <td className="px-2 py-3">{item.dosage || "—"}</td>
                    <td className="px-2 py-3">{item.frequency || "—"}</td>
                    <td className="px-2 py-3">{item.duration || "—"}</td>
                    <td className="px-2 py-3">{item.quantity ?? "—"}</td>
                    <td className="px-2 py-3">{item.route || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {printedPrescription.items.some((item) => item.instructions) && (
              <div className="mt-6">
                <h3 className="mb-2 font-bold">Instructions</h3>

                <div className="space-y-2 text-sm">
                  {printedPrescription.items.map(
                    (item) =>
                      item.instructions && (
                        <div key={item.id}>
                          <span className="font-semibold">
                            {item.medicine_name}:
                          </span>{" "}
                          {item.instructions}
                        </div>
                      )
                  )}
                </div>
              </div>
            )}

            {printedPrescription.notes && (
              <div className="mt-6">
                <h3 className="mb-2 font-bold">Prescription Notes</h3>
                <p className="text-sm">{printedPrescription.notes}</p>
              </div>
            )}
          </section>

          <div className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-2">
            <div>
              <div className="border-b border-gray-900 pb-2" />
              <p className="mt-2 text-sm">Prescriber Signature</p>
            </div>

            <div>
              <div className="border-b border-gray-900 pb-2" />
              <p className="mt-2 text-sm">Date</p>
            </div>
          </div>

          <div className="mt-10 border-t border-gray-300 pt-4 text-center text-xs text-gray-500">
            {practiceSettings.practice_name || "Medical Practice"}
            {practiceSettings.practice_code
              ? ` • Practice Code: ${practiceSettings.practice_code}`
              : ""}
          </div>
        </div>
      )}
    </>
  );
}
