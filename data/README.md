# ICD-10 reference data

`icd10-who-2019.json` is a code/title lookup extracted without changing the titles from the WHO ICD-10 2019 metadata distribution, including COVID-19 updates. It contains 12,221 categories/codes and 22 chapters; it is not the South African Master Industry Table. The supplied WHO metadata does not include all coding instructions. Selection never guarantees diagnosis, eligibility, billing validity or payer acceptance.

Source: https://icdcdn.who.int/icd10/meta/icd102019enMeta.zip
Download page: https://icdcdn.who.int/icd10/index.html
Source file: `icd102019syst_codes.txt`; code column 7, title column 9, terminal column 2, secondary mark from column 6. Chapter names are from `icd102019syst_chapters.txt`. No US ICD-10-CM mapping has been applied.

© World Health Organization. International Classification of Diseases Tenth Revision (ICD-10), Sixth Edition, 2019. Geneva: World Health Organization; 2019. License: CC BY-ND 3.0 IGO, https://creativecommons.org/licenses/by-nd/3.0/igo/ . Titles reproduced unchanged; lookup-only excerpt. No WHO endorsement is implied. License statement: https://icd.who.int/browse10/Content/statichtml/ICD10Volume2_en_2019.pdf . Definitive reference: https://icd.who.int/browse10/2019/en .

South African coding verification: https://www.health.gov.za/icd-10-master-industry-table/ . The South African MIT is linked, not redistributed.

The medication templates in `lib/medication-catalog.ts` are independently authored generic inventory product facts, not copied treatment guidance, a registered-medicine database, scheduling advice or recommended treatments. They contain no patient doses, treatment frequencies, prices or stock. All newly imported templates require prescription review by default; practices must confirm product-specific requirements and pack units.
