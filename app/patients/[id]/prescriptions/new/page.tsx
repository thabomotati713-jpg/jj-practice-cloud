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
      router.push("/");
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
      router.push("/");
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
      <main style={{ padding: 24 }}>
        <h1>New Prescription</h1>
        <p>Loading patient information...</p>
      </main>
    );
  }

  if (!patient) {
    return (
      <main style={{ padding: 24 }}>
        <h1>New Prescription</h1>
        <p>{message || "Patient not found."}</p>

        <button onClick={() => router.push("/patients")}>
          Back to Patients
        </button>
      </main>
    );
  }

  const patientName =
    `${patient.first_name} ${patient.middle_name || ""} ${patient.last_name}`
      .replace(/\s+/g, " ")
      .trim();

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <h1>New Prescription</h1>
          <p style={{ margin: 0, color: "#666" }}>
            {patientName} — {patient.patient_id}
          </p>
        </div>

        <button
          onClick={() =>
            router.push(`/patients/${patientId}/prescriptions`)
          }
        >
          Back to Prescriptions
        </button>
      </div>

      <section
        style={{
          padding: 18,
          marginBottom: 20,
          border: "1px solid #ddd",
          borderRadius: 10,
          background: "#f8fafc",
        }}
      >
        <strong>{patientName}</strong>
        <div>Patient ID: {patient.patient_id}</div>
        <div>Phone: {patient.phone || "Not provided"}</div>

        {consultation && (
          <div style={{ marginTop: 12 }}>
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
      </section>

      {message && (
        <div
          style={{
            padding: 12,
            marginBottom: 20,
            borderRadius: 8,
            background: "#f1f5f9",
          }}
        >
          {message}
        </div>
      )}

      <form onSubmit={savePrescription} style={{ display: "grid", gap: 20 }}>
        <section className="card">
          <h2>Prescription Details</h2>

          <label>
            Prescription Date *
            <input
              type="date"
              value={prescriptionDate}
              onChange={(e) => setPrescriptionDate(e.target.value)}
              required
              style={{
                width: "100%",
                padding: 10,
                marginTop: 6,
              }}
            />
          </label>

          <label style={{ display: "block", marginTop: 16 }}>
            Prescription Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="General prescription notes..."
              style={{
                width: "100%",
                padding: 10,
                marginTop: 6,
              }}
            />
          </label>
        </section>

        <section className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2>Medicines</h2>
              <p style={{ color: "#666" }}>
                Select a stocked medicine when available, or enter a
                medicine manually.
              </p>
            </div>

            <button type="button" onClick={addItem}>
              + Add Medicine
            </button>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            {items.map((item, index) => {
              const selectedProduct = inventoryProducts.find(
                (product) =>
                  product.id === item.inventory_product_id
              );

              return (
                <div
                  key={index}
                  style={{
                    padding: 18,
                    border: "1px solid #ddd",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <h3 style={{ margin: 0 }}>
                      Medicine {index + 1}
                    </h3>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <label style={{ display: "block", marginBottom: 14 }}>
                    Inventory Medicine
                    <select
                      value={item.inventory_product_id}
                      onChange={(e) =>
                        selectInventoryProduct(
                          index,
                          e.target.value
                        )
                      }
                      style={{
                        width: "100%",
                        padding: 10,
                        marginTop: 6,
                      }}
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
                      <div
                        style={{
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 8,
                          background: "#f0fdf4",
                          fontSize: 14,
                        }}
                      >
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

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 14,
                    }}
                  >
                    <label>
                      Medicine Name *
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
                        style={{
                          width: "100%",
                          padding: 10,
                          marginTop: 6,
                        }}
                      />
                    </label>

                    <label>
                      Strength
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
                        style={{
                          width: "100%",
                          padding: 10,
                          marginTop: 6,
                        }}
                      />
                    </label>

                    <label>
                      Dosage *
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
                        style={{
                          width: "100%",
                          padding: 10,
                          marginTop: 6,
                        }}
                      />
                    </label>

                    <label>
                      Frequency *
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
                        style={{
                          width: "100%",
                          padding: 10,
                          marginTop: 6,
                        }}
                      />
                    </label>

                    <label>
                      Duration *
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
                        style={{
                          width: "100%",
                          padding: 10,
                          marginTop: 6,
                        }}
                      />
                    </label>

                    <label>
                      Quantity *
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
                        style={{
                          width: "100%",
                          padding: 10,
                          marginTop: 6,
                        }}
                      />
                    </label>

                    <label>
                      Route
                      <select
                        value={item.route}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "route",
                            e.target.value
                          )
                        }
                        style={{
                          width: "100%",
                          padding: 10,
                          marginTop: 6,
                        }}
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

                  <label
                    style={{
                      display: "block",
                      marginTop: 14,
                    }}
                  >
                    Instructions
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
                      style={{
                        width: "100%",
                        padding: 10,
                        marginTop: 6,
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.push(`/patients/${patientId}/prescriptions`)
            }
          >
            Cancel
          </button>

          <button type="submit" disabled={saving}>
            {saving ? "Saving Prescription..." : "Save Prescription"}
          </button>
        </div>
      </form>
    </main>
  );
}
