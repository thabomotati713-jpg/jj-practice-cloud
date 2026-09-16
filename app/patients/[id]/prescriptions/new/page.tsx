"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  phone: string | null;
};

type Consultation = {
  id: string;
  consultation_date: string | null;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment: string | null;
};

type InventoryProduct = {
  id: string;
  name: string;
  generic_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  current_stock: number | null;
  unit: string | null;
  prescription_required: boolean;
  active: boolean;
};

type PrescriptionItem = {
  inventory_product_id: string;
  medicine_name: string;
  strength: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  route: string;
  instructions: string;
};

const emptyItem: PrescriptionItem = {
  inventory_product_id: "",
  medicine_name: "",
  strength: "",
  dosage: "",
  frequency: "",
  duration: "",
  quantity: "",
  route: "",
  instructions: "",
};

const routes = [
  "Oral",
  "Topical",
  "Inhaled",
  "Intramuscular",
  "Intravenous",
  "Subcutaneous",
  "Rectal",
  "Ophthalmic",
  "Otic",
  "Nasal",
  "Other",
];

export default function NewPrescriptionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const patientId = params.id as string;
  const consultationId = searchParams.get("consultation_id");

  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultation, setConsultation] =
    useState<Consultation | null>(null);

  const [inventoryProducts, setInventoryProducts] = useState<
    InventoryProduct[]
  >([]);

  const [prescriptionDate, setPrescriptionDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PrescriptionItem[]>([
    { ...emptyItem },
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, [patientId, consultationId]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.practice_id) {
      setMessage("Unable to determine your practice.");
      setLoading(false);
      return;
    }

    const { data: patientData, error: patientError } = await supabase
      .from("patients")
      .select(
        "id, patient_id, first_name, middle_name, last_name, phone"
      )
      .eq("id", patientId)
      .eq("practice_id", profile.practice_id)
      .single();

    if (patientError || !patientData) {
      setMessage("Patient could not be found.");
      setLoading(false);
      return;
    }

    setPatient(patientData);

    const { data: inventoryData, error: inventoryError } =
      await supabase
        .from("inventory_products")
        .select(
          "id, name, generic_name, strength, dosage_form, current_stock, unit, prescription_required, active"
        )
        .eq("practice_id", profile.practice_id)
        .eq("active", true)
        .order("name", { ascending: true });

    if (!inventoryError) {
      setInventoryProducts(inventoryData || []);
    }

    if (consultationId) {
      const { data: consultationData } = await supabase
        .from("consultations")
        .select(
          "id, consultation_date, chief_complaint, diagnosis, treatment"
        )
        .eq("id", consultationId)
        .eq("patient_id", patientId)
        .eq("practice_id", profile.practice_id)
        .single();

      if (consultationData) {
        setConsultation(consultationData);
      }
    }

    setLoading(false);
  }

  function updateItem(
    index: number,
    field: keyof PrescriptionItem,
    value: string
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function selectInventoryProduct(index: number, productId: string) {
    const product = inventoryProducts.find(
      (item) => item.id === productId
    );

    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (!product) {
          return {
            ...item,
            inventory_product_id: "",
          };
        }

        return {
          ...item,
          inventory_product_id: product.id,
          medicine_name: product.name,
          strength: product.strength || "",
        };
      })
    );
  }

  function addItem() {
    setItems((current) => [...current, { ...emptyItem }]);
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      return;
    }

    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function validateItems() {
    if (items.length === 0) {
      return "Add at least one medicine.";
    }

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const number = index + 1;

      if (!item.medicine_name.trim()) {
        return `Medicine ${number}: enter the medicine name or select an inventory medicine.`;
      }

      if (!item.dosage.trim()) {
        return `Medicine ${number}: enter the dosage.`;
      }

      if (!item.frequency.trim()) {
        return `Medicine ${number}: enter the frequency.`;
      }

      if (!item.duration.trim()) {
        return `Medicine ${number}: enter the duration.`;
      }

      if (!item.quantity.trim()) {
        return `Medicine ${number}: enter the quantity.`;
      }

      const quantity = Number(item.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return `Medicine ${number}: quantity must be greater than zero.`;
      }

      if (item.inventory_product_id) {
        const product = inventoryProducts.find(
          (inventoryItem) =>
            inventoryItem.id === item.inventory_product_id
        );

        if (!product) {
          return `Medicine ${number}: selected inventory medicine could not be found.`;
        }
      }
    }

    return null;
  }

  async function savePrescription(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");

    if (!prescriptionDate) {
      setMessage("Please select a prescription date.");
      return;
    }

    const itemError = validateItems();

    if (itemError) {
      setMessage(itemError);
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.practice_id) {
      setMessage("Unable to determine your practice.");
      setSaving(false);
      return;
    }

    const prescriptionNumber = `RX-${Date.now()}`;

    const { data: prescription, error: prescriptionError } =
      await supabase
        .from("prescriptions")
        .insert({
          practice_id: profile.practice_id,
          patient_id: patientId,
          consultation_id: consultationId || null,
          provider_id: user.id,
          prescription_number: prescriptionNumber,
          prescription_date: prescriptionDate,
          notes: notes.trim() || null,
          status: "active",
        })
        .select("id")
        .single();

    if (prescriptionError || !prescription) {
      setMessage(
        prescriptionError?.message ||
          "Unable to create prescription."
      );
      setSaving(false);
      return;
    }

    const itemRows = items.map((item) => ({
      prescription_id: prescription.id,
      inventory_product_id:
        item.inventory_product_id || null,
      medicine_name: item.medicine_name.trim(),
      strength: item.strength.trim() || null,
      dosage: item.dosage.trim(),
      frequency: item.frequency.trim(),
      duration: item.duration.trim(),
      quantity: Number(item.quantity),
      route: item.route.trim() || null,
      instructions: item.instructions.trim() || null,
    }));

    const { error: insertItemsError } = await supabase
      .from("prescription_items")
      .insert(itemRows);

    if (insertItemsError) {
      await supabase
        .from("prescriptions")
        .delete()
        .eq("id", prescription.id);

      setMessage(
        `Prescription was not completed: ${insertItemsError.message}`
      );
      setSaving(false);
      return;
    }

    router.push(`/patients/${patientId}/prescriptions`);
  }

  if (loading) {
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
          </div>
        </header>

        <div className="page-inner">
          <div className="page-header">
            <div>
              <h1 className="page-title">New Prescription</h1>
            </div>
          </div>

          <div className="card">
            <div className="empty-state">
              Loading patient information...
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!patient) {
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
          </div>
        </header>

        <div className="page-inner">
          <div className="page-header">
            <div>
              <h1 className="page-title">New Prescription</h1>
            </div>

            <div className="page-actions">
              <button
                onClick={() => router.push("/patients")}
                className="btn btn-secondary btn-sm"
              >
                Back to Patients
              </button>
            </div>
          </div>

          {message && <div className="alert-error">{message}</div>}

          {!message && (
            <div className="card">
              <div className="empty-state">Patient not found.</div>
            </div>
          )}
        </div>
      </main>
    );
  }

  const patientName =
    `${patient.first_name} ${patient.middle_name || ""} ${patient.last_name}`
      .replace(/\s+/g, " ")
      .trim();

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

          <button
            onClick={() =>
              router.push(`/patients/${patientId}/prescriptions`)
            }
            className="btn btn-secondary btn-sm"
          >
            Back to Prescriptions
          </button>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">New Prescription</h1>
            <p className="page-subtitle">
              {patientName} — {patient.patient_id}
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <strong>{patientName}</strong>
            <div>Patient ID: {patient.patient_id}</div>
            <div>Phone: {patient.phone || "Not provided"}</div>

            {consultation && (
              <div className="alert-info mt-4 mb-0">
                <strong>Linked Consultation</strong>

                {consultation.chief_complaint && (
                  <div>
                    Complaint: {consultation.chief_complaint}
                  </div>
                )}

                {consultation.diagnosis && (
                  <div>
                    Diagnosis: {consultation.diagnosis}
                  </div>
                )}

                {consultation.treatment && (
                  <div>
                    Treatment: {consultation.treatment}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {message && <div className="alert-error">{message}</div>}

        <form onSubmit={savePrescription} className="space-y-5">
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Prescription Details</h2>
            </div>

            <div className="card-body">
              <label className="field">
                <span className="label">Prescription Date *</span>
                <input
                  type="date"
                  value={prescriptionDate}
                  onChange={(e) => setPrescriptionDate(e.target.value)}
                  required
                  className="input"
                />
              </label>

              <label className="field mb-0">
                <span className="label">Prescription Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="General prescription notes..."
                  className="input"
                />
              </label>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Medicines</h2>
                <p className="page-subtitle">
                  Select a stocked medicine when available, or enter a
                  medicine manually.
                </p>
              </div>

              <button
                type="button"
                onClick={addItem}
                className="btn btn-primary btn-sm"
              >
                + Add Medicine
              </button>
            </div>

            <div className="card-body space-y-5">
              {items.map((item, index) => {
                const selectedProduct = inventoryProducts.find(
                  (product) =>
                    product.id === item.inventory_product_id
                );

                return (
                  <div
                    key={index}
                    className="rounded-xl border border-gray-200 p-4"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold">
                        Medicine {index + 1}
                      </h3>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="btn btn-danger btn-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <label className="field">
                      <span className="label">Inventory Medicine</span>
                      <select
                        value={item.inventory_product_id}
                        onChange={(e) =>
                          selectInventoryProduct(
                            index,
                            e.target.value
                          )
                        }
                        className="input"
                      >
                        <option value="">
                          Not linked to inventory
                        </option>

                        {inventoryProducts.map((product) => (
                          <option
                            key={product.id}
                            value={product.id}
                          >
                            {product.name}
                            {product.strength
                              ? ` — ${product.strength}`
                              : ""}
                            {` — Stock: ${product.current_stock ?? 0}`}
                          </option>
                        ))}
                      </select>

                      {selectedProduct && (
                        <div className="mt-2 rounded-lg p-3 text-sm" style={{ background: "var(--brand-50)", color: "var(--brand-800)" }}>
                          <strong>Inventory linked</strong>
                          <div>
                            {selectedProduct.name}
                            {selectedProduct.strength
                              ? ` ${selectedProduct.strength}`
                              : ""}
                            {selectedProduct.dosage_form
                              ? ` — ${selectedProduct.dosage_form}`
                              : ""}
                          </div>
                          <div>
                            Available stock:{" "}
                            {selectedProduct.current_stock ?? 0}{" "}
                            {selectedProduct.unit || ""}
                          </div>
                        </div>
                      )}
                    </label>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="field mb-0">
                        <span className="label">Medicine Name *</span>
                        <input
                          type="text"
                          value={item.medicine_name}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "medicine_name",
                              e.target.value
                            )
                          }
                          placeholder="e.g. Amoxicillin"
                          required
                          className="input"
                        />
                      </label>

                      <label className="field mb-0">
                        <span className="label">Strength</span>
                        <input
                          type="text"
                          value={item.strength}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "strength",
                              e.target.value
                            )
                          }
                          placeholder="e.g. 500mg"
                          className="input"
                        />
                      </label>

                      <label className="field mb-0">
                        <span className="label">Dosage *</span>
                        <input
                          type="text"
                          value={item.dosage}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "dosage",
                              e.target.value
                            )
                          }
                          placeholder="e.g. 1 capsule"
                          required
                          className="input"
                        />
                      </label>

                      <label className="field mb-0">
                        <span className="label">Frequency *</span>
                        <input
                          type="text"
                          value={item.frequency}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "frequency",
                              e.target.value
                            )
                          }
                          placeholder="e.g. 3 times daily"
                          required
                          className="input"
                        />
                      </label>

                      <label className="field mb-0">
                        <span className="label">Duration *</span>
                        <input
                          type="text"
                          value={item.duration}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "duration",
                              e.target.value
                            )
                          }
                          placeholder="e.g. 7 days"
                          required
                          className="input"
                        />
                      </label>

                      <label className="field mb-0">
                        <span className="label">Quantity *</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "quantity",
                              e.target.value
                            )
                          }
                          placeholder="e.g. 21"
                          required
                          className="input"
                        />
                      </label>

                      <label className="field mb-0">
                        <span className="label">Route</span>
                        <select
                          value={item.route}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "route",
                              e.target.value
                            )
                          }
                          className="input"
                        >
                          <option value="">Select route</option>

                          {routes.map((route) => (
                            <option key={route} value={route}>
                              {route}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="field mt-4 mb-0">
                      <span className="label">Instructions</span>
                      <textarea
                        value={item.instructions}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "instructions",
                            e.target.value
                          )
                        }
                        rows={3}
                        placeholder="Additional instructions for the patient..."
                        className="input"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="page-actions justify-end">
            <button
              type="button"
              onClick={() =>
                router.push(`/patients/${patientId}/prescriptions`)
              }
              className="btn btn-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? "Saving Prescription..." : "Save Prescription"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
