import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import "../../app/js/plan-model.js";

const PM = globalThis.PlanModel;
const FIXTURE = new URL("./fixtures/eli-2026-11-17.json", import.meta.url);
const clone = (x) => JSON.parse(JSON.stringify(x));
const st = (state, note = "") => ({ state, note });

function oldState() {
  const dom = (stages) => ({ score: 3, baseScore: 3, reason: "", line: "", known: [], stages, extraQs: [], answers: {}, notes: "", myView: "", blockers: [], resources: [], suggestRemove: false });
  const five = () => [st("unknown"), st("unknown"), st("unknown"), st("unknown"), st("unknown")];
  return {
    version: 1, client: "בדיקה", meeting: 1, view: "map", removed: [], custom: [],
    domains: { marketing: dom(five()), sales: dom(five()), product: dom(five()), money: dom(five()), team: dom(five()), owner: dom(five()) },
    vision: { answers: {}, vision: "", bigGoal: "", goal90: "", myView: "" },
    summary: { active: [], frozen: [], blockers: [], resources: [], myView: "" }, savedAt: null,
  };
}
const step = (S, ref) => { const [j, i] = ref.split("."); return S.journey.find((x) => x.id === j).steps[+i]; };

test("JOURNEYS has 4 journeys with the exact step names", () => {
  assert.equal(PM.JOURNEYS.length, 4);
  assert.deepEqual(PM.JOURNEYS.map((j) => j.id), ["j1", "j2", "j3", "j4"]);
  assert.deepEqual(PM.JOURNEYS.map((j) => j.name), ["מחשיפה לפנייה", "מפנייה לסגירה", "מסגירה לסיום", "מסיום להמלצה או לחזרה"]);
  assert.deepEqual(PM.JOURNEYS[0].steps, ["איפה הלקוח נמצא", "מה הוא שומע עלינו", "למה דווקא אני", "איך פונים"]);
  assert.deepEqual(PM.JOURNEYS[1].steps, ["מענה לפנייה", "שיחת היכרות", "הצעת מחיר", "סגירה", "מעקב אחרי מי שלא סגר"]);
  assert.deepEqual(PM.JOURNEYS[2].steps, ["קליטה", "השירות עצמו", "תשלום וגבייה", "סיום מסודר"]);
  assert.deepEqual(PM.JOURNEYS[3].steps, ["בקשת המלצה", "שמירת קשר", "חזרה"]);
});

test("MOVED_QS lists the 11 moves with valid targets", () => {
  const e = Object.entries(PM.MOVED_QS);
  assert.equal(e.length, 11);
  assert.deepEqual(PM.MOVED_QS["מי חייב לך כסף עכשיו, כמה, ומאיזה חודש?"], { from: "money", to: "j3.2" });
  for (const [, m] of e) {
    const [j, i] = m.to.split(".");
    const J = PM.JOURNEYS.find((x) => x.id === j);
    assert.ok(J && J.steps[+i], m.to);
  }
});

test("migrate builds the journey with all steps unknown", () => {
  const S = PM.migrate(oldState());
  assert.equal(S.planV, 2);
  assert.deepEqual(S.journey.map((j) => j.steps.length), [4, 5, 4, 3]);
  assert.deepEqual(step(S, "j3.0"), { name: "קליטה", state: "unknown", note: "", answers: {} });
  assert.deepEqual([S.recs, S.dilemmas, S.notes], [[], [], []]);
});

test("migrate copies sales stage states to j2", () => {
  const x = oldState();
  x.domains.sales.stages = [st("weak"), st("ok", "טוב"), st("weak"), st("ok"), st("weak")];
  const S = PM.migrate(x);
  assert.deepEqual(S.journey[1].steps.map((s) => s.state), ["weak", "ok", "weak", "ok", "weak"]);
  assert.equal(S.journey[1].steps[1].note, "טוב");
  assert.equal(S.domains.sales.stages, undefined);
});

test("migrate copies marketing stages and keeps 'מי הלקוח' as a note", () => {
  const x = oldState();
  x.domains.marketing.stages = [st("weak", "לא ברור"), st("ok"), st("missing", "שמועות"), st("weak"), st("ok", "חוזרים")];
  const S = PM.migrate(x);
  assert.equal(step(S, "j1.0").state, "ok");
  assert.deepEqual([step(S, "j1.1").state, step(S, "j1.1").note], ["missing", "שמועות"]);
  assert.equal(step(S, "j1.3").state, "weak");
  assert.equal(step(S, "j1.2").state, "unknown");
  assert.deepEqual([step(S, "j4.0").state, step(S, "j4.0").note], ["ok", "חוזרים"]);
  assert.deepEqual(S.notes.map((n) => n.text), ["שיווק · מי הלקוח: חלש לא ברור"]);
  assert.equal(S.domains.marketing.stages, undefined);
});

test("migrate drops product stage 3 and keeps its note as a note", () => {
  const x = oldState();
  x.domains.product.stages = [st("ok", "a"), st("ok"), st("weak"), st("missing", "רק שירות א'"), st("weak", "e")];
  const S = PM.migrate(x);
  assert.deepEqual(S.domains.product.stages, [st("ok", "a"), st("ok"), st("weak"), st("weak", "e")]);
  assert.deepEqual(S.notes.map((n) => n.text), ["מוצרים · מה מרוויח: רק שירות א'"]);
  assert.equal(S.domains.money.stages.length, 5);
});

test("migrate moves answers of moved questions", () => {
  const x = oldState();
  const q = "מי חייב לך כסף עכשיו, כמה, ומאיזה חודש?";
  // map.html stores base-question answers under "b:" + question text
  x.domains.money.answers["b:" + q] = "שלושה לקוחות, 4,000 ₪";
  x.domains.money.answers["b:איך אתה יודע בסוף החודש מה היה?"] = "לא יודע";
  x.domains.sales.answers["b:מה קורה עם מי שלא סגר? מי מתקשר, מתי?"] = "  ";
  x.domains.sales.answers["b:מה אתה מבטיח ללקוח בשיחת המכירה – והאם זה תמיד קורה בפועל?"] = "הכול";
  x.domains.sales.qEdits = { "b:מה אתה מבטיח ללקוח בשיחת המכירה – והאם זה תמיד קורה בפועל?": "מה אתה מבטיח?" };
  const S = PM.migrate(x);
  assert.equal(step(S, "j3.2").answers[q], "שלושה לקוחות, 4,000 ₪");
  assert.equal(S.domains.money.answers["b:" + q], undefined);
  assert.equal(S.domains.money.answers["b:איך אתה יודע בסוף החודש מה היה?"], "לא יודע");
  assert.deepEqual(step(S, "j2.4").answers, {});
  const j31 = step(S, "j3.1");
  assert.equal(j31.answers["מה אתה מבטיח ללקוח בשיחת המכירה – והאם זה תמיד קורה בפועל?"], "הכול");
  assert.deepEqual(j31.qEdits, { "מה אתה מבטיח ללקוח בשיחת המכירה – והאם זה תמיד קורה בפועל?": "מה אתה מבטיח?" });
  assert.deepEqual(S.domains.sales.qEdits, {});
});

test("migrate also accepts answers keyed by plain question text", () => {
  const x = oldState();
  const q = "מאיפה הגיעו 5 הלקוחות האחרונים?";
  x.domains.marketing.answers[q] = "המלצות";
  assert.equal(step(PM.migrate(x), "j1.0").answers[q], "המלצות");
});

test("migrate puts the removed team question's answer into the team's private notes, never a client note", () => {
  const x = oldState();
  const q = "מה עשית השבוע שמישהו אחר היה יכול לעשות?";
  x.domains.team.answers["b:" + q] = "הנהלת חשבונות";
  x.domains.team.notes = "הערה קיימת";
  const S = PM.migrate(x);
  assert.deepEqual(S.notes, []);
  assert.equal(S.domains.team.notes, "הערה קיימת\n" + q + " → הנהלת חשבונות");
  assert.equal(S.domains.team.answers["b:" + q], undefined);
  const json = JSON.stringify(PM.exportPlan(S));
  assert.ok(!json.includes("הנהלת חשבונות") && !json.includes(q));
  const again = PM.migrate(S); // idempotent
  assert.equal(again.domains.team.notes, "הערה קיימת\n" + q + " → הנהלת חשבונות");
});

test("migrate labels an unplaced stage note in Hebrew (domain name and stage name)", () => {
  const x = oldState();
  x.domains.sales.stages.push(st("weak", "שלב נוסף"));
  x.domains.marketing.stages.push(st("unknown", "עוד"));
  const S = PM.migrate(x);
  assert.deepEqual(S.notes.map((n) => n.text), ["שיווק · שלב 6: עוד", "מכירות · שלב 6: חלש שלב נוסף"]);
  assert.ok(S.notes.every((n) => !/marketing|sales/.test(n.text)));
});

test("prefillStages keeps the old 5-stage prefill for marketing/sales/product so migrate maps it", () => {
  const old5 = ["weak", "ok", "missing", "ok", "weak"];
  const prodDef = ["מה מוכרים היום", "מה מבקשים ממני", "במה אני הכי טוב", "מוצר מרכזי ונלווים"];
  const x = oldState();
  x.domains.marketing.stages = PM.prefillStages("marketing", [], old5);
  x.domains.sales.stages = PM.prefillStages("sales", [], old5);
  x.domains.product.stages = PM.prefillStages("product", prodDef, ["ok", "ok", "weak", "missing", "weak"]);
  x.domains.money.stages = PM.prefillStages("money", ["a", "b", "c", "d", "e"], ["ok"]);
  const S = PM.migrate(x);
  assert.deepEqual(S.journey[1].steps.map((s) => s.state), old5);
  assert.equal(step(S, "j1.0").state, "ok");
  assert.equal(step(S, "j4.0").state, "weak");
  assert.deepEqual(S.domains.product.stages.map((s) => s.state), ["ok", "ok", "weak", "weak"]);
  assert.deepEqual(S.domains.money.stages.map((s) => s.state), ["ok", "unknown", "unknown", "unknown", "unknown"]);
  // new-shape prefill (or none) follows the template's stages
  assert.deepEqual(PM.prefillStages("marketing", [], undefined), []);
  assert.deepEqual(PM.prefillStages("product", prodDef, ["ok", "weak", "ok", "missing"]).map((s) => s.state), ["ok", "weak", "ok", "missing"]);
});

test("migrate moves Eli's real answers to the journey", { skip: !existsSync(FIXTURE) && "Eli fixture missing" }, () => {
  const S = PM.migrate(JSON.parse(readFileSync(FIXTURE, "utf8")));
  assert.ok(txtOf(step(S, "j1.0").answers["מאיפה הגיעו 5 הלקוחות האחרונים?"]));
  assert.ok(txtOf(step(S, "j2.1").answers["תתאר שיחה עם פונה מהרגע שהוא מתקשר ועד שהוא אומר כן."]));
  assert.equal(S.domains.marketing.answers["b:מאיפה הגיעו 5 הלקוחות האחרונים?"], undefined);
});
const txtOf = (v) => (typeof v === "string" ? v.trim() : "");

test("migrate turns old blockers/resources into notes and frozen into frozen recs", () => {
  const x = oldState();
  x.summary.blockers = [{ text: "פחד להעלות מחיר", rec: "לנסות על חדשים" }, { text: "", rec: "" }, { text: "אין סדר", rec: "" }];
  x.summary.resources = [{ text: "לקוחות מרוצים", rec: "לבקש המלצות" }];
  x.summary.frozen = [{ item: "שיווק", reason: "אין זמן", condition: "אחרי החגים" }, { item: "", reason: "", condition: "" }];
  const S = PM.migrate(x);
  assert.deepEqual(S.notes.map((n) => n.text), ["חסם: פחד להעלות מחיר – לנסות על חדשים", "חסם: אין סדר", "משאב: לקוחות מרוצים – לבקש המלצות"]);
  assert.equal(S.recs.length, 1);
  const r = S.recs[0];
  assert.deepEqual([r.title, r.why.text, r.returnWhen, r.domainId, r.status], ["שיווק", "אין זמן", "אחרי החגים", null, "frozen"]);
  assert.equal("blockers" in S.summary || "resources" in S.summary || "frozen" in S.summary, false);
});

test("migrate keeps active milestones as they are", () => {
  const x = oldState();
  const a = { domainId: "money", goal: "ג", target: "", milestones: [{ title: "m1", date: "2026-11-30" }], myView: "" };
  x.summary.active = [clone(a)];
  assert.deepEqual(PM.migrate(x).summary.active, [a]);
});

test("migrate is idempotent", () => {
  const x = oldState();
  x.domains.sales.stages[2] = st("weak", "n");
  x.summary.blockers = [{ text: "b", rec: "r" }];
  x.summary.frozen = [{ item: "i", reason: "", condition: "" }];
  x.domains.product.stages[3].note = "p";
  const once = PM.migrate(clone(x));
  const twice = PM.migrate(PM.migrate(clone(x)));
  // ids and timestamps differ between separate runs, so compare the second run to a clone of the first
  const first = PM.migrate(clone(x));
  const snap = clone(first);
  assert.deepEqual(PM.migrate(first), snap);
  assert.equal(PM.migrate(first), first);
  assert.equal(twice.notes.length, once.notes.length);
  assert.equal(twice.recs.length, once.recs.length);
  assert.equal(twice.domains.product.stages.length, 4);
});

test("migrate keeps every text", { skip: !existsSync(FIXTURE) && "Eli fixture missing" }, () => {
  const input = JSON.parse(readFileSync(FIXTURE, "utf8"));
  const texts = [];
  (function walk(v, key) {
    if (typeof v === "string") { if (v.trim() && !/^(id|domainId|score|baseScore)$/.test(key)) texts.push(v); }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { walk(k.replace(/^b:/, ""), ""); walk(x, k); }
  })(input, "");
  const out = JSON.stringify(PM.migrate(clone(input)));
  const missing = texts.filter((t) => !out.includes(JSON.stringify(t).slice(1, -1)));
  assert.deepEqual(missing, []);
});

test("sortNote moves once", () => {
  const S = PM.migrate(oldState());
  S.notes.push(PM.newNote("להעלות מחיר"), PM.newNote("לשכור עוד מטפל?"), PM.newNote("גובה בתחילת חודש"), PM.newNote("זבל"));
  const [a, b, c, d] = S.notes.map((n) => n.id);
  PM.sortNote(S, a, { kind: "rec", domainId: "sales" });
  assert.equal(S.notes.length, 3);
  assert.equal(S.recs.length, 1);
  assert.deepEqual([S.recs[0].title, S.recs[0].domainId, S.recs[0].status], ["להעלות מחיר", "sales", "active"]);
  PM.sortNote(S, a, { kind: "rec", domainId: "sales" });
  assert.equal(S.recs.length, 1);
  PM.sortNote(S, b, { kind: "dilemma" });
  assert.equal(S.dilemmas.length, 1);
  assert.equal(S.dilemmas[0].q, "לשכור עוד מטפל?");
  PM.sortNote(S, c, { kind: "known", domainId: "money" });
  assert.ok(S.domains.money.known.includes("גובה בתחילת חודש"));
  PM.sortNote(S, d, { kind: "delete" });
  assert.equal(S.notes.length, 0);
});

test("new items have the right shapes and unique ids", () => {
  const r = PM.newRec({ title: "x", domainId: "money", step: "j3.2" });
  assert.deepEqual({ ...r, id: 0 }, { id: 0, title: "x", domainId: "money", step: "j3.2", why: { text: "", blocker: "", resource: "", rule: null }, status: "active", returnWhen: "", tasks: [], myView: "" });
  const t = PM.newTask(r.id);
  assert.deepEqual({ ...t, id: 0 }, { id: 0, what: "", firstStep: "", pro: null, due: "", status: "todo", msIdx: null });
  const dl = PM.newDilemma();
  assert.deepEqual({ ...dl, id: 0 }, { id: 0, q: "", needed: "", returnWhen: "", status: "open", decision: "" });
  const n = PM.newNote("טקסט");
  assert.equal(n.text, "טקסט");
  assert.ok(!isNaN(Date.parse(n.at)));
  const ids = new Set([r.id, t.id, dl.id, n.id, ...Array.from({ length: 50 }, () => PM.newRec({ title: "" }).id)]);
  assert.equal(ids.size, 54);
});

test("task keeps professional copy", () => {
  const t = PM.newTask("r1");
  const pro = { id: "p1", name: "יוסי רו\"ח", field: "הנהלת חשבונות", phone: "050", secret: "x" };
  PM.pickPro(t, pro);
  pro.name = "שונה";
  assert.deepEqual(t.pro, { id: "p1", name: "יוסי רו\"ח", field: "הנהלת חשבונות", phone: "050" });
});

test("recommendation keeps rule copy", () => {
  const r = PM.newRec({ title: "x" });
  const rule = { id: "u1", title: "כלל", body: "גוף", tags: ["a"] };
  PM.pickRule(r, rule);
  rule.body = "שונה";
  assert.deepEqual(r.why.rule, { id: "u1", title: "כלל", body: "גוף" });
});

test("goalProgress uses milestones when present, else tasks", () => {
  const S = PM.migrate(oldState());
  S.summary.active = [{ domainId: "money", goal: "", target: "", milestones: [{ title: "a", done: true }, { title: "b", done: true }, { title: "c" }], myView: "" }];
  assert.deepEqual(PM.goalProgress(S, 0), { done: 2, total: 3, by: "milestones" });
  S.summary.active[0].milestones = [];
  const r1 = PM.newRec({ title: "r1", domainId: "money" });
  const r2 = PM.newRec({ title: "r2", domainId: "sales" });
  r1.tasks = [{ ...PM.newTask(r1.id), status: "done" }, PM.newTask(r1.id), { ...PM.newTask(r1.id), status: "doing" }];
  r2.tasks = [{ ...PM.newTask(r2.id), status: "done" }];
  S.recs.push(r1, r2);
  assert.deepEqual(PM.goalProgress(S, 0), { done: 1, total: 3, by: "tasks" });
});

test("goalProgress ignores empty milestone slots", () => {
  const S = PM.migrate(oldState());
  S.summary.active = [{ domainId: "money", milestones: [{ title: "", date: "2026-11-30" }, { title: "", date: "" }] }];
  assert.deepEqual(PM.goalProgress(S, 0), { done: 0, total: 0, by: "tasks" });
});

const TEMPLATE = "J:/האחסון שלי/ייעוץ עסקי/כלי אבחון/תבנית - מפת אבחון.html";
test("no question appears twice across DOMAINS and JOURNEY_QS", { skip: !existsSync(TEMPLATE) }, () => {
  const src = readFileSync(TEMPLATE, "utf8");
  const m = src.match(/const DOMAINS = (\[[\s\S]*?\n\]);/);
  assert.ok(m, "DOMAINS not found");
  const DOMAINS = new Function("return " + m[1])();
  const domQs = DOMAINS.flatMap((d) => d.qs);
  const jQs = Object.values(PM.JOURNEY_QS).flat();
  const all = [...domQs, ...jQs];
  assert.equal(new Set(all).size, all.length, "duplicate question");
  for (const q of Object.keys(PM.MOVED_QS)) {
    assert.ok(jQs.includes(q), "moved q missing from JOURNEY_QS: " + q);
    assert.ok(!domQs.includes(q), "moved q still in DOMAINS: " + q);
  }
  for (const q of Object.keys(PM.REMOVED_QS)) assert.ok(!all.includes(q), "removed q present: " + q);
  assert.deepEqual(DOMAINS.find((d) => d.id === "marketing").stages, []);
  assert.deepEqual(DOMAINS.find((d) => d.id === "sales").stages, []);
  assert.ok(!DOMAINS.find((d) => d.id === "product").stages.includes("מה מרוויח"));
});

test("migrate keeps all 4 product stages of a fresh (already new-shape) map", () => {
  const x = oldState();
  x.domains.product.stages = [st("ok"), st("ok"), st("weak"), st("missing", "מוצר מרכזי")];
  const S = PM.migrate(x);
  assert.equal(S.domains.product.stages.length, 4);
  assert.equal(S.domains.product.stages[3].note, "מוצר מרכזי");
});

test("v2 state with a missing or broken journey is rebuilt, other lists filled", () => {
  const S = { version: 1, planV: 2, journey: "x", recs: [{ id: "r1" }], domains: {}, summary: {} };
  PM.migrate(S);
  assert.equal(S.journey.length, 4);
  assert.deepEqual(S.recs, [{ id: "r1" }]);
  assert.ok(Array.isArray(S.notes) && Array.isArray(S.dilemmas));
  const T = { planV: 2 };
  PM.ensure(T);
  assert.equal(T.journey[1].steps.length, 5);
});

test("goalProgress by tasks ignores frozen recommendations", () => {
  const S = PM.migrate(oldState());
  S.summary.active = [{ domainId: "money", milestones: [] }];
  const r1 = PM.newRec({ title: "on", domainId: "money" });
  const r2 = PM.newRec({ title: "off", domainId: "money", status: "frozen" });
  r1.tasks = [PM.newTask(r1.id)];
  r2.tasks = [PM.newTask(r2.id), PM.newTask(r2.id)];
  S.recs.push(r1, r2);
  assert.deepEqual(PM.goalProgress(S, 0), { done: 0, total: 1, by: "tasks" });
});

test("removeMilestone clears tasks pointing at it and shifts later ones (same domain only)", () => {
  const S = PM.migrate(oldState());
  S.summary.active = [{ domainId: "money", milestones: [{ title: "a" }, { title: "b" }, { title: "c" }] }];
  const r = PM.newRec({ domainId: "money" }), o = PM.newRec({ domainId: "sales" });
  r.tasks = [0, 1, 2, null].map((m) => ({ ...PM.newTask(r.id), msIdx: m }));
  o.tasks = [{ ...PM.newTask(o.id), msIdx: 2 }];
  S.recs.push(r, o);
  assert.equal(PM.removeMilestone(S, 0, 1), true);
  assert.deepEqual(S.summary.active[0].milestones.map((m) => m.title), ["a", "c"]);
  assert.deepEqual(r.tasks.map((t) => t.msIdx), [0, null, 1, null]);
  assert.equal(o.tasks[0].msIdx, 2);
  assert.equal(PM.removeMilestone(S, 0, 5), false);
});

test("dilemmaSplit: open first, decided apart, order kept", () => {
  const S = PM.migrate({ version: 1, domains: {}, summary: {} });
  const mk = (q, status) => Object.assign(PM.newDilemma(), { q, status });
  S.dilemmas.push(mk("a", "decided"), mk("b", "open"), mk("c", "decided"), mk("d", "open"));
  const r = PM.dilemmaSplit(S);
  assert.deepEqual(r.open.map((d) => d.q), ["b", "d"]);
  assert.deepEqual(r.decided.map((d) => d.q), ["a", "c"]);
  assert.deepEqual(PM.dilemmaSplit({}), { open: [], decided: [] });
});

test("notesNewest: newest first; migrated notes with the same time show last-added first", () => {
  const S = PM.migrate({ version: 1, domains: {}, summary: {} });
  S.notes.push({ id: "1", text: "old", at: "2026-11-01T10:00:00.000Z" }, { id: "2", text: "new", at: "2026-11-17T10:00:00.000Z" },
    { id: "3", text: "same-a", at: "2026-11-05T10:00:00.000Z" }, { id: "4", text: "same-b", at: "2026-11-05T10:00:00.000Z" }, { id: "5", text: "no time" });
  assert.deepEqual(PM.notesNewest(S).map((n) => n.text), ["new", "same-b", "same-a", "old", "no time"]);
  assert.equal(S.notes[0].text, "old"); // not reordered in place
});

// ---- Task 7: export and recap ----
function richState() {
  const S = PM.migrate(oldState());
  S.domains.sales.score = 2; S.domains.sales.reason = "סיבה פנימית"; S.domains.sales.myView = "דעה פנימית";
  S.domains.sales.answers["b:שאלה"] = "תשובה סודית";
  step(S, "j2.2").state = "weak"; step(S, "j2.2").note = "נבהל ממחיר";
  step(S, "j2.4").state = "missing";
  step(S, "j2.0").state = "ok";
  step(S, "j2.1").answers["תתאר שיחה"] = "תשובת מסע סודית";
  S.summary.active.push({ domainId: "sales", goal: "יותר סגירות", target: "", kind: "count", start: "2", unit: "סגירות", milestones: [{ title: "תסריט", date: "2026-12-31", done: false }], myView: "דעה על התחום" });
  S.summary.myView = "דעה על התוכנית";
  const r = PM.newRec({ title: 'אמר "יקר לי"\nושתק', domainId: "sales" });
  r.myView = "דעה על ההמלצה"; r.why.text = "כי"; PM.pickRule(r, { id: "x1", title: "כלל", body: "גוף" });
  const t = PM.newTask(r.id); t.what = "לכתוב תסריט"; t.due = "2026-12-01";
  PM.pickPro(t, { id: "p1", name: "דוד", field: "קופי", phone: "050" });
  r.tasks.push(t);
  S.recs.push(r, PM.newRec({ title: "רעיון קפוא", status: "frozen" }));
  S.dilemmas.push(Object.assign(PM.newDilemma(), { q: "להעלות מחיר?", status: "open" }), Object.assign(PM.newDilemma(), { q: "הוחלט", status: "decided" }));
  S.notes.push(PM.newNote("פתק פתוח"));
  return S;
}

test("exportPlan keeps Hebrew quotes and newlines", () => {
  const S = richState();
  const out = JSON.parse(JSON.stringify(PM.exportPlan(S)));
  assert.equal(out.recs.find((r) => r.status === "active").title, 'אמר "יקר לי"\nושתק');
});

test("exportPlan has no myView, answers, scores, pros list", () => {
  const S = richState();
  const out = PM.exportPlan(S, (id) => ({ sales: "מכירות" })[id] || id);
  const bad = ["myView", "answers", "score", "baseScore", "scores", "reason", "reasons", "pros", "rules", "qEdits", "extraQs"];
  const walk = (v, path) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, path + "[" + i + "]"));
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { assert.ok(!bad.includes(k), "forbidden key " + path + "." + k); walk(x, path + "." + k); }
  };
  walk(out, "plan");
  const json = JSON.stringify(out);
  for (const secret of ["תשובה סודית", "תשובת מסע סודית", "סיבה פנימית", "דעה פנימית", "דעה על ההמלצה", "דעה על התחום", "דעה על התוכנית"]) assert.ok(!json.includes(secret), secret);
  // what it does carry
  assert.deepEqual(Object.keys(out).sort(), ["bigGoal", "dilemmas", "domains", "goal90", "journey", "notes", "recs", "vision"].sort());
  assert.equal(out.domains[0].name, "מכירות");
  assert.equal(out.recs[0].tasks[0].pro.name, "דוד");
  assert.equal(out.recs[0].why.rule.title, "כלל");
  assert.equal(PM.stepOf(out, "j2.2").note, "נבהל ממחיר");
  assert.equal(out.dilemmas.length, 2);
  assert.equal(out.notes[0].text, "פתק פתוח");
});

test("recap: journey shows where it falls (weak/missing + note), works line kept", () => {
  const sec = PM.recapJourney(richState());
  assert.equal(sec.title, "מסע הלקוח – איפה נופלים");
  const j2 = sec.groups.find((g) => g[0] === "מפנייה לסגירה");
  assert.ok(j2.includes("עובד: מענה לפנייה"));
  assert.ok(j2.includes("חלש – הצעת מחיר: נבהל ממחיר"));
  assert.ok(j2.includes("חסר – מעקב אחרי מי שלא סגר"));
  assert.equal(sec.groups.length, 1); // untouched journeys are left out
  assert.equal(PM.recapJourney(PM.migrate(oldState())), null);
});

test("recap: plan sections – active recs with tasks, ideas titles, open dilemmas, unsorted notes", () => {
  const secs = PM.recapPlan(richState(), (id) => ({ sales: "מכירות" })[id] || id);
  assert.deepEqual(secs.map((s) => s.title), ["המלצות ומשימות", "מאגר רעיונות", "דילמות פתוחות", "פתקים שעוד לא מוינו"]);
  const rec = secs[0].groups[0];
  assert.equal(rec[0], 'אמר "יקר לי"\nושתק (מכירות)');
  assert.ok(rec.some((x) => x.startsWith("משימה: לכתוב תסריט") && x.includes("דוד") && x.includes("2026-12-01")));
  assert.deepEqual(secs[1].items, ["רעיון קפוא"]);
  assert.deepEqual(secs[2].items, ["להעלות מחיר?"]);
  assert.deepEqual(secs[3].items, ["פתק פתוח"]);
  assert.ok(!JSON.stringify(secs).includes("דעה על ההמלצה"));
  assert.deepEqual(PM.recapPlan(PM.migrate(oldState())), []);
});

test("removeStep clears recs pointing at the step and shifts later steps of the same journey", () => {
  const S = PM.migrate(oldState());
  const recs = ["j2.1", "j2.2", "j2.4", "j3.2", null].map((step) => PM.newRec({ step }));
  S.recs.push(...recs);
  assert.equal(PM.removeStep(S, 1, 2), true);
  assert.deepEqual(S.journey[1].steps.map((s) => s.name), ["מענה לפנייה", "שיחת היכרות", "סגירה", "מעקב אחרי מי שלא סגר"]);
  assert.deepEqual(recs.map((r) => r.step), ["j2.1", null, "j2.3", "j3.2", null]);
  assert.equal(PM.stepOf(S, recs[2].step).name, "מעקב אחרי מי שלא סגר");
  assert.equal(PM.removeStep(S, 1, 9), false);
  assert.equal(PM.removeStep(S, 7, 0), false);
});

test("deactivateDomain removes the active domain and clears its tasks' milestone links only", () => {
  const S = PM.migrate(oldState());
  S.summary.active = [{ domainId: "money", goal: "x", milestones: [{ title: "a" }] }, { domainId: "sales", milestones: [{ title: "b" }] }];
  const r = PM.newRec({ domainId: "money" }), o = PM.newRec({ domainId: "sales" });
  r.tasks = [{ ...PM.newTask(r.id), msIdx: 0 }];
  o.tasks = [{ ...PM.newTask(o.id), msIdx: 0 }];
  S.recs.push(r, o);
  assert.equal(PM.activeHasContent(S.summary.active[0]), true);
  assert.equal(PM.activeHasContent({ domainId: "x", goal: " ", target: "", milestones: [{ title: "" }], myView: "" }), false);
  PM.deactivateDomain(S, "money");
  assert.deepEqual(S.summary.active.map((a) => a.domainId), ["sales"]);
  assert.equal(r.tasks[0].msIdx, null);
  assert.equal(o.tasks[0].msIdx, 0);
});
