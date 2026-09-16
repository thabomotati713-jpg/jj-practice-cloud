import type { SpecialtyId } from "./specialties";

/*
 * Per-specialty starter catalogs — realistic stock a practice of that
 * kind actually carries. Used by the "Load starter catalog" action on
 * the inventory page so a new dental/optical/physio practice starts
 * with relevant stock instead of a generic medical list.
 */

export type CatalogItem = {
  name: string;
  category: string;
  generic_name?: string;
  unit?: string;
  dosage_form?: string;
  prescription_required?: boolean;
  minimum_stock: number;
};

const DENTAL: CatalogItem[] = [
  { name: "Complete Upper Denture (False Teeth)", category: "Dental Materials", unit: "each", minimum_stock: 2 },
  { name: "Complete Lower Denture (False Teeth)", category: "Dental Materials", unit: "each", minimum_stock: 2 },
  { name: "Partial Denture Acrylic Kit", category: "Dental Materials", unit: "kit", minimum_stock: 2 },
  { name: "Fluoride Toothpaste (Patient Packs)", category: "Consumables", unit: "tube", minimum_stock: 20 },
  { name: "Toothbrushes (Patient Packs)", category: "Consumables", unit: "each", minimum_stock: 20 },
  { name: "Composite Filling Material", category: "Dental Materials", unit: "syringe", minimum_stock: 5 },
  { name: "Dental Amalgam Capsules", category: "Dental Materials", unit: "capsule", minimum_stock: 10 },
  { name: "Lignocaine 2% with Adrenaline (Dental)", category: "Anaesthetics", unit: "cartridge", minimum_stock: 20, prescription_required: true },
  { name: "Dental Needles (Local Anaesthetic)", category: "Anaesthetics", unit: "box of 100", minimum_stock: 4 },
  { name: "Glass Ionomer Cement", category: "Dental Materials", unit: "kit", minimum_stock: 3 },
  { name: "Rubber Dam Sheets", category: "Dental Materials", unit: "box", minimum_stock: 3 },
  { name: "Prophylaxis Polishing Paste", category: "Consumables", unit: "cup", minimum_stock: 15 },
  { name: "Dental Examination Kits (Mirror + Probe)", category: "Dental Instruments", unit: "set", minimum_stock: 5 },
  { name: "Extraction Forceps Set", category: "Dental Instruments", unit: "set", minimum_stock: 2 },
  { name: "Autoclave Sterilisation Pouches", category: "Sterilisation", unit: "box of 200", minimum_stock: 4 },
  { name: "Ultrasonic Scaler Tips", category: "Dental Instruments", unit: "each", minimum_stock: 3 },
  { name: "Dental Bibs", category: "Consumables", unit: "box of 50", minimum_stock: 4 },
  { name: "Impression Trays (Reusable)", category: "Dental Instruments", unit: "set", minimum_stock: 3 },
  { name: "Articulating Paper", category: "Dental Materials", unit: "pack", minimum_stock: 5 },
  { name: "Temporary Filling Material", category: "Dental Materials", unit: "pack", minimum_stock: 4 },
];

const OPTICAL: CatalogItem[] = [
  { name: "Reading Glasses (Assorted Powers)", category: "Frames", unit: "each", minimum_stock: 10 },
  { name: "Metal Frame — Full Rim", category: "Frames", unit: "each", minimum_stock: 6 },
  { name: "Plastic Frame — Full Rim", category: "Frames", unit: "each", minimum_stock: 6 },
  { name: "Rimless Frames", category: "Frames", unit: "each", minimum_stock: 3 },
  { name: "Single Vision Lens Blanks", category: "Lenses", unit: "pair", minimum_stock: 10 },
  { name: "Bifocal Lens Blanks", category: "Lenses", unit: "pair", minimum_stock: 5 },
  { name: "Progressive Lens Blanks", category: "Lenses", unit: "pair", minimum_stock: 4 },
  { name: "Daily Disposable Contact Lenses", category: "Contact Lenses", unit: "box of 30", minimum_stock: 6 },
  { name: "Monthly Contact Lenses", category: "Contact Lenses", unit: "box", minimum_stock: 6 },
  { name: "Multi-Purpose Contact Lens Solution", category: "Solutions", unit: "bottle", minimum_stock: 10 },
  { name: "Saline Solution", category: "Solutions", unit: "bottle", minimum_stock: 8 },
  { name: "Tonometer Probe Tips", category: "Instruments", unit: "each", minimum_stock: 4 },
  { name: "Ophthalmoscope Batteries", category: "Instruments", unit: "each", minimum_stock: 3 },
  { name: "Lens Cleaning Spray", category: "Solutions", unit: "bottle", minimum_stock: 12 },
  { name: "Trial Lens Set Replacement", category: "Instruments", unit: "set", minimum_stock: 2 },
];

const PHYSIO: CatalogItem[] = [
  { name: "Resistance Bands (Assorted)", category: "Exercise Equipment", unit: "each", minimum_stock: 12 },
  { name: "Exercise Balls (65cm)", category: "Exercise Equipment", unit: "each", minimum_stock: 4 },
  { name: "Strapping Tape (Rigid)", category: "Strapping", unit: "roll", minimum_stock: 15 },
  { name: "Kinesiology Tape", category: "Strapping", unit: "roll", minimum_stock: 12 },
  { name: "Elasticated Support Bandages", category: "Strapping", unit: "each", minimum_stock: 10 },
  { name: "Heat Packs (Reusable)", category: "Electrotherapy", unit: "each", minimum_stock: 6 },
  { name: "Cold Packs (Instant)", category: "Consumables", unit: "each", minimum_stock: 10 },
  { name: "Ultrasound Gel", category: "Electrotherapy", unit: "litre", minimum_stock: 4 },
  { name: "TENS Electrode Pads", category: "Electrotherapy", unit: "pack of 4", minimum_stock: 8 },
  { name: "Massage Cream / Wax", category: "Consumables", unit: "tub", minimum_stock: 6 },
  { name: "Foam Rollers", category: "Exercise Equipment", unit: "each", minimum_stock: 4 },
  { name: "Disposable Sheets / Toweling", category: "Consumables", unit: "box", minimum_stock: 5 },
  { name: "Crutch Handles (Spare)", category: "Exercise Equipment", unit: "pair", minimum_stock: 3 },
];

const GENERAL: CatalogItem[] = [
  { name: "Paracetamol 500mg", category: "Medication", unit: "box", minimum_stock: 10, prescription_required: false },
  { name: "Ibuprofen 400mg", category: "Medication", unit: "box", minimum_stock: 10, prescription_required: false },
  { name: "Amoxicillin 500mg", category: "Medication", unit: "box", minimum_stock: 8, prescription_required: true },
  { name: "Oral Rehydration Sachets", category: "Medication", unit: "box", minimum_stock: 10, prescription_required: false },
  { name: "Disposable Syringes 5ml", category: "Consumables", unit: "box of 100", minimum_stock: 4 },
  { name: "Examination Gloves (Medium)", category: "Consumables", unit: "box of 100", minimum_stock: 6 },
  { name: "Surgical Face Masks", category: "Consumables", unit: "box of 50", minimum_stock: 6 },
  { name: "Adhesive Plasters (Assorted)", category: "Consumables", unit: "box", minimum_stock: 8 },
  { name: "Gauze Swabs (Sterile)", category: "Consumables", unit: "pack", minimum_stock: 10 },
  { name: "Blood Pressure Monitor", category: "Equipment", unit: "each", minimum_stock: 1 },
];

export const SPECIALTY_CATALOGS: Record<SpecialtyId, CatalogItem[]> = {
  general: GENERAL,
  dental: DENTAL,
  optical: OPTICAL,
  physio: PHYSIO,
  derma: GENERAL, // dermatology practices typically stock the medical list plus cosmeceuticals
  paeds: GENERAL,
  other: GENERAL,
};
