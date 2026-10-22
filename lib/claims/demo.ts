import type { ClaimSnapshot } from "./model";
// Fictional sample only. The public demo never calls a claim API or sends email.
export function demoClaim(day = "2026-10-22"): ClaimSnapshot {
  return {
    version: 1,
    claim_id: "00000000-0000-4000-8000-000000000001",
    practice_id: "00000000-0000-4000-8000-000000000002",
    patient_id: "00000000-0000-4000-8000-000000000003",
    claim_number: "DEMO-CLAIM-001",
    claim_date: day,
    practice: {
      name: "FICTIONAL DEMO PRACTICE",
      email: "demo@example.invalid",
      phone: "0000000000",
      address: "Demonstration address, South Africa",
    },
    patient: {
      name: "Fictional Sample Patient",
      dob: "2000-01-01",
      identity: "DEMO-PASSPORT-NOT-REAL",
    },
    member: {
      scheme: "Discovery Health Medical Scheme",
      number: "DEMO-NOT-A-MEMBER",
      dependent: "00",
      main_member: "Fictional Main Member",
      plan: "Demonstration only",
    },
    provider: {
      id: "00000000-0000-4000-8000-000000000004",
      name: "Dr Fictional Clinician",
      pcns: "0000000",
      registration: "DEMO-NOT-REGISTERED",
    },
    consultation: {
      id: "00000000-0000-4000-8000-000000000005",
      service_date: day,
      diagnosis_code: "I10",
    },
    invoice: {
      id: "00000000-0000-4000-8000-000000000006",
      number: "DEMO-INVOICE-001",
      date: day,
      subtotal: 500,
      discount: 0,
      tax: 0,
      total: 500,
      paid: 0,
      balance: 500,
      status: "unpaid",
      lines: [
        {
          id: "00000000-0000-4000-8000-000000000007",
          description: "Fictional consultation for demonstration only",
          service_code: "DEMO",
          quantity: 1,
          unit_price: 500,
          discount: 0,
          tax: 0,
          total: 500,
          diagnosis_code: "I10",
        },
      ],
    },
    authorization_number: "DEMO ONLY",
  };
}
