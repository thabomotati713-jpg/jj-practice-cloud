export type IcdCode = {
  code: string;
  title: string;
  chapter: string;
  terminal: boolean;
  secondary: boolean;
};
export const COMMON_CODES = [
  "I10",
  "E11.9",
  "J06.9",
  "J00",
  "J45.9",
  "K21.9",
  "N39.0",
  "M54.5",
  "R51",
  "R50.9",
  "K02.9",
  "H52.1",
  "L30.9",
  "B34.9",
  "U07.1",
];
export function searchIcdCodes(
  codes: IcdCode[],
  query: string,
  chapter = "",
  terminalOnly = false,
) {
  const q = query.trim().toLocaleLowerCase();
  const compact = q.replace(/\./g, "");
  const terms = q.split(/\s+/).filter(Boolean);
  return codes
    .filter(
      (row) =>
        (!chapter || row.chapter === chapter) &&
        (!terminalOnly || (row.terminal && !row.secondary)) &&
        (!q ||
          row.code.toLowerCase().replace(/\./g, "").startsWith(compact) ||
          terms.every((term) => row.title.toLowerCase().includes(term))),
    )
    .sort((a, b) => {
      const rank = (row: IcdCode) =>
        q
          ? row.code.toLowerCase().replace(/\./g, "") === compact
            ? 0
            : row.code.toLowerCase().replace(/\./g, "").startsWith(compact)
              ? 1
              : 2
          : COMMON_CODES.includes(row.code)
            ? 0
            : 1;
      return rank(a) - rank(b) || a.code.localeCompare(b.code);
    });
}
