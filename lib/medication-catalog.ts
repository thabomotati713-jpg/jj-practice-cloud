import type { CatalogItem } from "./specialty-catalog";

// Generic product templates, authored for inventory setup. These are not a
// formulary, prescribing guidance, SA registration or scheduling declarations.
export type MedicationTemplate = CatalogItem & {
  group: string;
  strength: string;
};
const groups: Record<string, string[]> = {
  "Pain & inflammation": [
    "Paracetamol|500 mg|Tablet",
    "Paracetamol|120 mg/5 mL|Oral suspension",
    "Paracetamol|250 mg/5 mL|Oral suspension",
    "Ibuprofen|200 mg|Tablet",
    "Ibuprofen|400 mg|Tablet",
    "Ibuprofen|100 mg/5 mL|Oral suspension",
    "Diclofenac|25 mg|Tablet",
    "Diclofenac|50 mg|Tablet",
    "Diclofenac|1%|Gel",
    "Naproxen|250 mg|Tablet",
    "Naproxen|500 mg|Tablet",
    "Aspirin|100 mg|Tablet",
  ],
  "Anti-infectives": [
    "Amoxicillin|250 mg|Capsule",
    "Amoxicillin|500 mg|Capsule",
    "Amoxicillin|125 mg/5 mL|Oral suspension",
    "Amoxicillin|250 mg/5 mL|Oral suspension",
    "Amoxicillin / clavulanic acid|500 mg / 125 mg|Tablet",
    "Amoxicillin / clavulanic acid|875 mg / 125 mg|Tablet",
    "Azithromycin|250 mg|Tablet",
    "Azithromycin|500 mg|Tablet",
    "Azithromycin|200 mg/5 mL|Oral suspension",
    "Clarithromycin|500 mg|Tablet",
    "Flucloxacillin|250 mg|Capsule",
    "Flucloxacillin|500 mg|Capsule",
    "Cefalexin|250 mg|Capsule",
    "Cefalexin|500 mg|Capsule",
    "Cefuroxime|250 mg|Tablet",
    "Cefuroxime|500 mg|Tablet",
    "Doxycycline|100 mg|Capsule",
    "Metronidazole|200 mg|Tablet",
    "Metronidazole|400 mg|Tablet",
    "Nitrofurantoin|100 mg|Capsule",
    "Ciprofloxacin|250 mg|Tablet",
    "Ciprofloxacin|500 mg|Tablet",
    "Co-trimoxazole|400 mg / 80 mg|Tablet",
    "Co-trimoxazole|200 mg / 40 mg per 5 mL|Oral suspension",
    "Fluconazole|150 mg|Capsule",
    "Aciclovir|200 mg|Tablet",
    "Albendazole|400 mg|Tablet",
    "Mebendazole|100 mg|Tablet",
  ],
  "Heart & blood pressure": [
    "Amlodipine|5 mg|Tablet",
    "Amlodipine|10 mg|Tablet",
    "Enalapril|5 mg|Tablet",
    "Enalapril|10 mg|Tablet",
    "Enalapril|20 mg|Tablet",
    "Losartan|50 mg|Tablet",
    "Losartan|100 mg|Tablet",
    "Hydrochlorothiazide|12.5 mg|Tablet",
    "Hydrochlorothiazide|25 mg|Tablet",
    "Indapamide|1.5 mg|Modified-release tablet",
    "Furosemide|40 mg|Tablet",
    "Spironolactone|25 mg|Tablet",
    "Atenolol|50 mg|Tablet",
    "Bisoprolol|5 mg|Tablet",
    "Carvedilol|6.25 mg|Tablet",
    "Simvastatin|20 mg|Tablet",
    "Simvastatin|40 mg|Tablet",
    "Atorvastatin|10 mg|Tablet",
    "Atorvastatin|20 mg|Tablet",
    "Atorvastatin|40 mg|Tablet",
    "Clopidogrel|75 mg|Tablet",
  ],
  "Diabetes & endocrine": [
    "Metformin|500 mg|Tablet",
    "Metformin|850 mg|Tablet",
    "Metformin|1 000 mg|Tablet",
    "Gliclazide|80 mg|Tablet",
    "Gliclazide|30 mg|Modified-release tablet",
    "Glimepiride|2 mg|Tablet",
    "Levothyroxine|50 micrograms|Tablet",
    "Levothyroxine|100 micrograms|Tablet",
    "Carbimazole|5 mg|Tablet",
  ],
  "Respiratory & allergy": [
    "Salbutamol|100 micrograms/actuation|Metered-dose inhaler",
    "Salbutamol|2.5 mg/2.5 mL|Nebuliser solution",
    "Beclometasone|100 micrograms/actuation|Metered-dose inhaler",
    "Budesonide|200 micrograms/actuation|Dry-powder inhaler",
    "Ipratropium bromide|20 micrograms/actuation|Metered-dose inhaler",
    "Cetirizine|10 mg|Tablet",
    "Cetirizine|1 mg/mL|Oral solution",
    "Loratadine|10 mg|Tablet",
    "Loratadine|5 mg/5 mL|Oral syrup",
    "Chlorphenamine|4 mg|Tablet",
    "Montelukast|10 mg|Tablet",
    "Fluticasone propionate|50 micrograms/actuation|Nasal spray",
    "Prednisone|5 mg|Tablet",
    "Prednisone|20 mg|Tablet",
  ],
  "Digestive health": [
    "Omeprazole|20 mg|Capsule",
    "Omeprazole|40 mg|Capsule",
    "Pantoprazole|40 mg|Tablet",
    "Lansoprazole|30 mg|Capsule",
    "Metoclopramide|10 mg|Tablet",
    "Ondansetron|4 mg|Tablet",
    "Hyoscine butylbromide|10 mg|Tablet",
    "Loperamide|2 mg|Capsule",
    "Lactulose|3.3 g/5 mL|Oral solution",
    "Bisacodyl|5 mg|Tablet",
    "Senna|7.5 mg|Tablet",
    "Oral rehydration salts||Powder sachet",
  ],
  "Skin, eye & ear": [
    "Clotrimazole|1%|Cream",
    "Miconazole|2%|Cream",
    "Terbinafine|1%|Cream",
    "Hydrocortisone|1%|Cream",
    "Betamethasone valerate|0.1%|Cream",
    "Mupirocin|2%|Ointment",
    "Fusidic acid|2%|Cream",
    "Aciclovir|5%|Cream",
    "Benzoyl peroxide|5%|Gel",
    "Permethrin|5%|Cream",
    "Calamine||Lotion",
    "Aqueous cream||Cream",
    "White soft paraffin||Ointment",
    "Chloramphenicol|0.5%|Eye drops",
    "Chloramphenicol|1%|Eye ointment",
    "Hypromellose|0.3%|Eye drops",
    "Sodium chloride|0.9%|Eye drops",
  ],
  "Supplements & other chronic care": [
    "Folic acid|5 mg|Tablet",
    "Ferrous sulphate|200 mg|Tablet",
    "Thiamine|100 mg|Tablet",
    "Pyridoxine|25 mg|Tablet",
    "Ascorbic acid|100 mg|Tablet",
    "Calcium carbonate|500 mg|Tablet",
    "Allopurinol|100 mg|Tablet",
    "Allopurinol|300 mg|Tablet",
    "Colchicine|0.5 mg|Tablet",
    "Amitriptyline|10 mg|Tablet",
    "Amitriptyline|25 mg|Tablet",
    "Fluoxetine|20 mg|Capsule",
    "Citalopram|20 mg|Tablet",
    "Sertraline|50 mg|Tablet",
  ],
};

export const MEDICATION_CATALOG: MedicationTemplate[] = Object.entries(
  groups,
).flatMap(([group, rows]) =>
  rows.map((row) => {
    const [generic_name, strength, dosage_form] = row.split("|");
    return {
      name: `${generic_name}${strength ? ` ${strength}` : ""} — ${dosage_form}`,
      generic_name,
      strength,
      dosage_form,
      group,
      category: "Medication",
      unit: /cream|gel|ointment/i.test(dosage_form)
        ? "tube"
        : /drops|solution|suspension|syrup|lotion/i.test(dosage_form)
          ? "bottle"
          : /inhaler|spray/i.test(dosage_form)
            ? "device"
            : /sachet/i.test(dosage_form)
              ? "sachet"
              : "tablet|capsule".split("|").includes(dosage_form.toLowerCase())
                ? dosage_form.toLowerCase()
                : "each",
      minimum_stock: 0,
      // Require review before dispensing; this flag is not a legal schedule.
      prescription_required: true,
    };
  }),
);

export function catalogKey(name: string) {
  return name
    .split("—")[0]
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9./%]/g, "");
}
