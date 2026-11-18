import { test } from "node:test";
import assert from "node:assert/strict";
import "../../app/js/plan-model.js";
import "../../app/js/plan-ui.js";

const PM = globalThis.PlanModel, UI = globalThis.PlanUI;
const journey = () => PM.migrate({ version: 1, domains: {}, summary: {} }).journey;

test("step questions follow the step after an earlier step is deleted", () => {
  const j2 = journey().find((j) => j.id === "j2");
  const followUp = j2.steps[4];
  j2.steps.splice(0, 1);
  assert.deepEqual(UI.stepQs(j2, followUp), PM.JOURNEY_QS["j2.4"]);
  assert.equal(followUp.ref, "j2.4");
});

test("ref is kept when the step is renamed later", () => {
  const j1 = journey()[0];
  UI.stepQs(j1, j1.steps[0]);
  j1.steps[0].name = "שם אחר";
  assert.deepEqual(UI.stepQs(j1, j1.steps[0]), PM.JOURNEY_QS["j1.0"]);
});

test("a new step has no default questions, but answered questions still show", () => {
  const j3 = journey()[2];
  const st = { name: "צעד חדש", state: "unknown", note: "", answers: { "שאלה ישנה": "תשובה" }, ref: "" };
  assert.deepEqual(UI.stepQs(j3, st), ["שאלה ישנה"]);
});

const names = { money: "כסף, ניהול ומערכות", sales: "מכירות ותמחור" };
const dn = (id) => names[id] || "";

test("ideas bank: category is the domain, else the journey step, else general (last)", () => {
  const S = PM.migrate({ version: 1, domains: {}, summary: {} });
  const a = PM.newRec({ title: "a", status: "frozen" });
  const b = PM.newRec({ title: "b", domainId: "money", status: "frozen" });
  const c = PM.newRec({ title: "c", step: "j2.2", status: "frozen" });
  const d = PM.newRec({ title: "d", domainId: "money" }); // active – not in the bank
  S.recs.push(a, b, c, d);
  assert.equal(UI.recCategory(S, c, dn), "הצעת מחיר");
  const g = UI.ideaGroups(S, dn);
  assert.deepEqual(g.map(([k, rs]) => [k, rs.map((r) => r.title)]), [["כסף, ניהול ומערכות", ["b"]], ["הצעת מחיר", ["c"]], ["כללי", ["a"]]]);
});

test("rule for the whole client becomes a frozen rec in the rule's domain (else general)", () => {
  const r = UI.ruleRec({ id: 13, grp: "לקוחות וכסף", title: "תמחור לפי ערך", body: "גוף" });
  assert.equal(r.status, "frozen");
  assert.equal(r.domainId, "sales");
  assert.deepEqual(r.why.rule, { id: 13, title: "תמחור לפי ערך", body: "גוף" });
  assert.equal(UI.ruleRec({ id: 23, title: "השקה בשלבים" }).domainId, null);
});

test("step options list every journey step with its ref", () => {
  const S = PM.migrate({ version: 1, domains: {}, summary: {} });
  const o = UI.stepOptions(S);
  assert.equal(o.length, 16);
  assert.deepEqual(o[5], { ref: "j2.1", name: "שיחת היכרות", journey: "מפנייה לסגירה" });
});
