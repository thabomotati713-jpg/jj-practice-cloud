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


const DERMA: CatalogItem[] = [
  { name: "Sunscreen SPF 50 (Face)", category: "Cosmeceuticals", unit: "tube", minimum_stock: 15 },
  { name: "Gentle Skin Cleanser", category: "Cosmeceuticals", unit: "bottle", minimum_stock: 12 },
  { name: "Barrier Repair Moisturiser", category: "Cosmeceuticals", unit: "tube", minimum_stock: 12 },
  { name: "Tretinoin Cream 0.025%", category: "Medication", unit: "tube", minimum_stock: 8, prescription_required: true },
  { name: "Hydroquinone Cream 2%", category: "Medication", unit: "tube", minimum_stock: 8, prescription_required: true },
  { name: "Topical Corticosteroid Cream", category: "Medication", unit: "tube", minimum_stock: 10, prescription_required: true },
  { name: "Clotrimazole Cream", category: "Medication", unit: "tube", minimum_stock: 10, prescription_required: false },
  { name: "Salicylic Acid Peel Solution", category: "Cosmeceuticals", unit: "bottle", minimum_stock: 4 },
  { name: "Punch Biopsy Set (Disposable)", category: "Consumables", unit: "each", minimum_stock: 8 },
  { name: "Curettes (Disposable)", category: "Consumables", unit: "box", minimum_stock: 3 },
  { name: "Cryotherapy Canister + Tips", category: "Equipment", unit: "kit", minimum_stock: 2 },
  { name: "Comedone Extractors", category: "Equipment", unit: "each", minimum_stock: 5 },
  { name: "Electrosurgery Handpiece Tips", category: "Equipment", unit: "each", minimum_stock: 4 },
  { name: "Sterile Dressing Packs", category: "Consumables", unit: "pack", minimum_stock: 10 },
  { name: "Nitrile Examination Gloves", category: "Consumables", unit: "box of 100", minimum_stock: 6 },
];

const PAEDS: CatalogItem[] = [
  { name: "Paracetamol Syrup (Paediatric)", category: "Medication", unit: "bottle", minimum_stock: 15, prescription_required: false },
  { name: "Ibuprofen Suspension (Paediatric)", category: "Medication", unit: "bottle", minimum_stock: 12, prescription_required: false },
  { name: "Oral Rehydration Solution (Paediatric)", category: "Medication", unit: "sachet box", minimum_stock: 15, prescription_required: false },
  { name: "Measles / MMR Vaccine", category: "Vaccines", unit: "vial", minimum_stock: 10, prescription_required: true },
  { name: "Pneumococcal Vaccine (PCV)", category: "Vaccines", unit: "vial", minimum_stock: 8, prescription_required: true },
  { name: "Rotavirus Vaccine", category: "Vaccines", unit: "vial", minimum_stock: 8, prescription_required: true },
  { name: "DTaP / Hib Vaccine", category: "Vaccines", unit: "vial", minimum_stock: 8, prescription_required: true },
  { name: "Polio Vaccine (IPV)", category: "Vaccines", unit: "vial", minimum_stock: 8, prescription_required: true },
  { name: "Vitamin A Drops", category: "Medication", unit: "bottle", minimum_stock: 10, prescription_required: false },
  { name: "Paediatric Inhaler Spacers", category: "Equipment", unit: "each", minimum_stock: 6 },
  { name: "Digital Thermometer (Soft Tip)", category: "Equipment", unit: "each", minimum_stock: 6 },
  { name: "Baby Scale", category: "Equipment", unit: "each", minimum_stock: 1 },
  { name: "Growth Charts (Road to Health)", category: "Stationery", unit: "pack", minimum_stock: 20 },
  { name: "Paediatric Blood Collection Tubes", category: "Consumables", unit: "box", minimum_stock: 5 },
  { name: "Colourful Plasters (Children's)", category: "Consumables", unit: "box", minimum_stock: 10 },
];

const OTHER_SPECIALIST: CatalogItem[] = [
  { name: "Examination Gloves (Assorted)", category: "Consumables", unit: "box of 100", minimum_stock: 6 },
  { name: "Surgical Face Masks", category: "Consumables", unit: "box of 50", minimum_stock: 6 },
  { name: "Sterile Gauze Swabs", category: "Consumables", unit: "pack", minimum_stock: 10 },
  { name: "Adhesive Plasters (Assorted)", category: "Consumables", unit: "box", minimum_stock: 8 },
  { name: "Alcohol Swabs", category: "Consumables", unit: "box", minimum_stock: 10 },
  { name: "Hand Sanitiser", category: "Consumables", unit: "bottle", minimum_stock: 8 },
  { name: "Sharps Container", category: "Consumables", unit: "each", minimum_stock: 3 },
  { name: "Examination Couch Roll Paper", category: "Consumables", unit: "roll", minimum_stock: 8 },
  { name: "Patient File Folders", category: "Stationery", unit: "pack", minimum_stock: 10 },
  { name: "Prescription Pads", category: "Stationery", unit: "pack", minimum_stock: 5 },
  { name: "Sphygmomanometer (BP Cuff)", category: "Equipment", unit: "each", minimum_stock: 1 },
  { name: "Stethoscope (Spare)", category: "Equipment", unit: "each", minimum_stock: 1 },
  { name: "Thermometer (Digital)", category: "Equipment", unit: "each", minimum_stock: 3 },
  { name: "Pulse Oximeter", category: "Equipment", unit: "each", minimum_stock: 2 },
];

export const SPECIALTY_CATALOGS: Record<SpecialtyId, CatalogItem[]> = {
  general: GENERAL,
  dental: DENTAL,
  optical: OPTICAL,
  physio: PHYSIO,
  derma: DERMA,
  paeds: PAEDS,
  other: OTHER_SPECIALIST,
};
