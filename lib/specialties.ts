/*
 * Specialty registry — tailors the portal to the kind of healthcare
 * provider using it (GP, dentist, optometrist, physiotherapist, …).
 *
 * A practice is never assumed to be a GP practice: every staff member
 * carries their own specialty, so a group practice can mix dentists,
 * optometrists and physiotherapists and each login sees workflows,
 * presets and inventory categories relevant to THAT doctor.
 */

export type SpecialtyId =
  | "general"
  | "dental"
  | "optical"
  | "physio"
  | "derma"
  | "paeds"
  | "other";

export type SpecialtyConfig = {
  id: SpecialtyId;
  label: string;
  /** Inventory category presets shown when adding stock. */
  inventoryCategories: string[];
  /** Common appointment reason presets. */
  appointmentReasons: string[];
};

export const SPECIALTIES: SpecialtyConfig[] = [
  {
    id: "general",
    label: "General Practitioner",
    inventoryCategories: [
      "Medication",
      "Vaccines",
      "Consumables",
      "Equipment",
      "Stationery",
    ],
    appointmentReasons: [
      "General check-up",
      "Flu symptoms",
      "Blood pressure review",
      "Chronic medication refill",
      "Wound care",
      "Vaccination",
    ],
  },
  {
    id: "dental",
    label: "Dentist",
    inventoryCategories: [
      "Dental Instruments",
      "Dental Materials",
      "Anaesthetics",
      "Sterilisation",
      "Consumables",
    ],
    appointmentReasons: [
      "Check-up & clean",
      "Filling",
      "Extraction",
      "Root canal",
      "Braces adjustment",
      "Dental emergency",
    ],
  },
  {
    id: "optical",
    label: "Optometrist",
    inventoryCategories: [
      "Frames",
      "Lenses",
      "Contact Lenses",
      "Solutions",
      "Instruments",
    ],
    appointmentReasons: [
      "Eye test",
      "Frame fitting",
      "Contact lens fitting",
      "Follow-up",
      "Visual field test",
    ],
  },
  {
    id: "physio",
    label: "Physiotherapist",
    inventoryCategories: [
      "Consumables",
      "Strapping",
      "Exercise Equipment",
      "Electrotherapy",
      "PPE",
    ],
    appointmentReasons: [
      "Initial assessment",
      "Follow-up treatment",
      "Back pain",
      "Sports injury",
      "Post-op rehab",
      "Chest physio",
    ],
  },
  {
    id: "derma",
    label: "Dermatologist",
    inventoryCategories: [
      "Consumables",
      "Cosmeceuticals",
      "Equipment",
      "Medication",
      "Stationery",
    ],
    appointmentReasons: [
      "Skin check",
      "Mole removal",
      "Acne treatment",
      "Follow-up",
      "Minor procedure",
    ],
  },
  {
    id: "paeds",
    label: "Paediatrician",
    inventoryCategories: [
      "Medication",
      "Vaccines",
      "Consumables",
      "Equipment",
      "Stationery",
    ],
    appointmentReasons: [
      "Well-child visit",
      "Vaccination",
      "Sick visit",
      "Development check",
      "Follow-up",
    ],
  },
  {
    id: "other",
    label: "Other Specialist",
    inventoryCategories: [
      "Medication",
      "Consumables",
      "Equipment",
      "Stationery",
    ],
    appointmentReasons: [
      "Consultation",
      "Follow-up",
      "Procedure",
      "Emergency",
    ],
  },
];

export function getSpecialty(id: string | null | undefined): SpecialtyConfig {
  return (
    SPECIALTIES.find((s) => s.id === id) ||
    SPECIALTIES.find((s) => s.id === "general")!
  );
}

export function specialtyLabel(id: string | null | undefined): string {
  if (!id) return "General Practice";
  return getSpecialty(id).label;
}

/**
 * Best-effort lookup of the current user's specialty from the staff
 * table. Works even before the `specialty` column migration runs —
 * any failure simply falls back to the general configuration.
 */
export async function fetchMySpecialty(
  supabase: { auth: { getUser: () => Promise<{ data: { user: { email?: string } | null } }> } },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any
): Promise<SpecialtyConfig> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    if (!email) return getSpecialty("general");

    const { data, error } = await client
      .from("staff")
      .select("specialty")
      .eq("email", email)
      .maybeSingle();

    if (error || !data) return getSpecialty("general");

    return getSpecialty((data as { specialty: string | null }).specialty);
  } catch {
    return getSpecialty("general");
  }
}
