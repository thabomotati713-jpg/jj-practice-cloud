const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("lib/marketing/config.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const box = { exports: {}, URL, Date, Error };
vm.runInNewContext(output, box);
const { organicAction, validFuture } = box.exports;
test("paid platforms and pending LinkedIn cannot publish", () => {
  for (const p of [
    "facebook_ads",
    "facebook_leads",
    "linkedin",
    "google_ads",
    "instagram",
    "boost_post",
  ])
    assert.throws(() => organicAction(p, "hello", null));
});
test("organic payloads target only approved actions", () => {
  assert.equal(organicAction("facebook", "hello", null).action, "create_post");
  const g = organicAction(
    "google_business",
    "demo",
    "https://example.com/demo",
  );
  assert.equal(g.action, "create_local_post");
  assert.equal(g.params.cta_type, "BOOK");
});
test("invalid content and unsafe URLs rejected", () => {
  assert.throws(() => organicAction("google_business", "a".repeat(1501), null));
  assert.throws(() => organicAction("facebook", "", null));
  assert.throws(() =>
    organicAction("facebook", "hello", "javascript:alert(1)"),
  );
});
test("schedules require future timestamp with explicit timezone", () => {
  assert.equal(validFuture(null), null);
  assert.throws(() => validFuture("bad"));
  assert.throws(() => validFuture("2020-01-01T12:00:00Z"));
  assert.throws(() => validFuture("2099-01-01T12:00"));
  assert.equal(
    validFuture("2099-01-01T12:00:00+02:00"),
    "2099-01-01T10:00:00.000Z",
  );
});
function harness({ fail = false, configured = true } = {}) {
  const row = {
    id: "post-1",
    platform: "facebook",
    body: "Demo",
    target_url: null,
    status: "ready",
    updated_at: "v1",
    auto_publish: false,
  };
  let sends = 0;
  const admin = {
    from() {
      let filters = [],
        patch = null;
      const query = {
        select() {
          return query;
        },
        eq(k, v) {
          filters.push([k, v]);
          return query;
        },
        update(p) {
          patch = p;
          return query;
        },
        single() {
          return Promise.resolve({ data: { ...row } });
        },
        maybeSingle() {
          return execute();
        },
        then(resolve, reject) {
          return execute().then(resolve, reject);
        },
      };
      function execute() {
        if (filters.every(([k, v]) => row[k] === v)) {
          if (patch) Object.assign(row, patch);
          return Promise.resolve({ data: { ...row }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }
      return query;
    },
  };
  const service = ts.transpileModule(
    fs.readFileSync("lib/marketing/service.ts", "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const ctx = {
    exports: {},
    Date,
    Error,
    require(name) {
      if (name === "server-only" || name === "@/lib/serverAccess") return {};
      if (name === "./config") return box.exports;
      if (name === "./windsor")
        return {
          configured: () => configured,
          publishOrganic: async () => {
            sends++;
            await new Promise((r) => setTimeout(r, 5));
            if (fail) throw new Error("timeout");
            return { result: "published" };
          },
        };
      throw new Error(name);
    },
  };
  vm.runInNewContext(service, ctx);
  return { row, admin, publish: ctx.exports.publishPost, sends: () => sends };
}
test("concurrent publishers send a post only once", async () => {
  const h = harness();
  const r = await Promise.allSettled([
    h.publish(h.admin, "post-1"),
    h.publish(h.admin, "post-1"),
  ]);
  assert.equal(h.sends(), 1);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(h.row.status, "published");
});
test("ambiguous send stops for review and cannot retry", async () => {
  const h = harness({ fail: true });
  await assert.rejects(h.publish(h.admin, "post-1"));
  assert.equal(h.row.status, "review_required");
  await assert.rejects(h.publish(h.admin, "post-1"));
  assert.equal(h.sends(), 1);
});
test("missing credential leaves draft untouched", async () => {
  const h = harness({ configured: false });
  await assert.rejects(h.publish(h.admin, "post-1"));
  assert.equal(h.row.status, "ready");
  assert.equal(h.sends(), 0);
});
test("scheduled worker ignores unapproved or future posts", async () => {
  const h = harness();
  await assert.rejects(h.publish(h.admin, "post-1", true));
  h.row.auto_publish = true;
  h.row.scheduled_at = "2099-01-01T00:00:00Z";
  await assert.rejects(h.publish(h.admin, "post-1", true));
  assert.equal(h.sends(), 0);
});
