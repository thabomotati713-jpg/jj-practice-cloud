const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const load = (path, imports = {}, extra = {}) => {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText,
    {
      exports,
      require: (name) => imports[name] || require(name),
      URL,
      Response,
      Request,
      console,
      ...extra,
    },
  );
  return exports;
};
const data = require("../data/icd10-who-2019.json");
const icd = load("lib/icd10.ts");
const appearance = load("lib/appearance.ts");
const medications = load("lib/medication-catalog.ts");
test("WHO dataset is complete for the supplied reference and codes are unique", () => {
  assert.equal(data.codes.length, 12221);
  assert.equal(data.chapters.length, 22);
  assert.equal(new Set(data.codes.map((x) => x.code)).size, data.codes.length);
  for (const code of ["I10", "E11.9", "J06.9", "U07.1"])
    assert(data.codes.some((x) => x.code === code && x.terminal));
  assert(
    data.codes.every(
      (x) =>
        /^[A-Z]\d{2}(\.\d{1,2})?$/.test(x.code) &&
        x.title &&
        data.chapters.some((c) => c.id === x.chapter),
    ),
  );
});
test("code matching ignores the decimal, ranks exact matches and supports all query words", () => {
  assert.equal(icd.searchIcdCodes(data.codes, "e119")[0].code, "E11.9");
  assert.equal(
    icd.searchIcdCodes(data.codes, "I10")[0].title,
    "Essential (primary) hypertension",
  );
  assert(
    icd
      .searchIcdCodes(data.codes, "type 2 diabetes")
      .some((x) => x.code === "E11.9"),
  );
  assert.equal(icd.searchIcdCodes(data.codes, "I10", "10").length, 0);
  assert(
    icd
      .searchIcdCodes(data.codes, "", "", true)
      .every((x) => x.terminal && !x.secondary),
  );
});
test("ICD API validates filters, paginates and caps the response", async () => {
  const { GET } = load("app/api/icd10/route.ts", {
    "@/data/icd10-who-2019.json": data,
    "@/lib/icd10": icd,
  });
  const a = await (
    await GET(new Request("https://local/api/icd10?limit=100000"))
  ).json();
  assert.equal(a.rows.length, 50);
  const b = await (
    await GET(new Request("https://local/api/icd10?limit=50&page=1"))
  ).json();
  assert.notEqual(a.rows[0].code, b.rows[0].code);
  assert.equal(
    (await GET(new Request("https://local/api/icd10?chapter=bogus"))).status,
    400,
  );
  assert.equal(
    (
      await (
        await GET(new Request("https://local/api/icd10?q=e119&terminal=true"))
      ).json()
    ).rows[0].code,
    "E11.9",
  );
});
test("medication templates contain no stock, prices or patient dosing defaults", () => {
  const rows = medications.MEDICATION_CATALOG;
  assert.equal(rows.length, 127);
  assert.equal(
    new Set(rows.map((x) => medications.catalogKey(x.name))).size,
    rows.length,
  );
  assert(
    rows.every(
      (x) =>
        x.generic_name &&
        x.dosage_form &&
        x.category === "Medication" &&
        x.prescription_required === true &&
        x.minimum_stock === 0,
    ),
  );
  assert(
    rows.every(
      (x) =>
        !("dosage" in x) &&
        !("frequency" in x) &&
        !("selling_price" in x) &&
        !("current_stock" in x),
    ),
  );
});
test("every theme validates and action labels keep 4.5:1 contrast even for a white accent", () => {
  assert.equal(appearance.THEME_COLLECTION.length, 8);
  assert(
    appearance.sameAppearance(appearance.DEFAULT_APPEARANCE, {
      density: "comfortable",
      radius: "soft",
      finish: "solid",
      color: "#1f7c7a",
    }),
  );
  assert.equal(appearance.PRESETS.length, 12);
  const vars = {};
  const document = {
    documentElement: {
      style: { setProperty: (key, val) => (vars[key] = val) },
      dataset: {},
    },
  };
  const client = load("lib/appearance.ts", {}, { document });
  for (const settings of [
    ...appearance.THEME_COLLECTION.map((x) => x.settings),
    { ...appearance.DEFAULT_APPEARANCE, color: "#ffffff" },
  ]) {
    assert(appearance.isAppearance(settings));
    client.applyAppearance(settings);
    const rgb = vars["--pc-action"]
      .match(/\w\w/g)
      .map((x) => parseInt(x, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    assert(
      1.05 / (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 + 0.05) >=
        4.5,
    );
  }
  assert(
    !appearance.isAppearance({
      ...appearance.DEFAULT_APPEARANCE,
      finish: "untrusted",
    }),
  );
});
test("practice appearance writes derive tenant from auth and reject unauthorised roles", async () => {
  let role = "owner",
    writes = [];
  const auth = {
    requireProfile: async () => ({
      profile: { role, practice_id: "own-practice" },
      user: { id: "user" },
      admin: {
        from: () => ({
          upsert: async (row) => {
            writes.push(row);
            return { error: null };
          },
          delete: () => ({
            eq: async (key, value) => {
              writes.push({ key, value });
              return { error: null };
            },
          }),
        }),
      },
    }),
    accessError: () => Response.json({ error: "auth" }, { status: 403 }),
  };
  const { PUT } = load("app/api/appearance/route.ts", {
    "../../../lib/serverAccess": auth,
    "../../../lib/appearance": appearance,
  });
  const request = (body) =>
    new Request("https://local/api/appearance", {
      method: "PUT",
      body: JSON.stringify(body),
    });
  role = "doctor";
  assert.equal(
    (await PUT(request({ settings: appearance.DEFAULT_APPEARANCE }))).status,
    403,
  );
  assert.equal(writes.length, 0);
  role = "owner";
  assert.equal(
    (
      await PUT(
        request({
          scope: "another-practice",
          settings: appearance.THEME_COLLECTION[1].settings,
        }),
      )
    ).status,
    200,
  );
  assert.equal(writes[0].scope, "own-practice");
  assert.equal(
    (await PUT(request({ settings: { color: "bad" } }))).status,
    400,
  );
  assert.equal(
    (await PUT(request({ reset: true, scope: "global" }))).status,
    200,
  );
  assert.equal(writes[1].value, "own-practice");
});
