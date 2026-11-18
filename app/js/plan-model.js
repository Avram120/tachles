/* Plan model (planV 2): customer journey, recommendations, tasks, dilemmas, notes.
   Classic script — no import/export. Pure data helpers; no DOM. Exposes globalThis.PlanModel. */
(function () {
  "use strict";

  const JOURNEYS = [
    { id: "j1", name: "מחשיפה לפנייה", steps: ["איפה הלקוח נמצא", "מה הוא שומע עלינו", "למה דווקא אני", "איך פונים"] },
    { id: "j2", name: "מפנייה לסגירה", steps: ["מענה לפנייה", "שיחת היכרות", "הצעת מחיר", "סגירה", "מעקב אחרי מי שלא סגר"] },
    { id: "j3", name: "מסגירה לסיום", steps: ["קליטה", "השירות עצמו", "תשלום וגבייה", "סיום מסודר"] },
    { id: "j4", name: "מסיום להמלצה או לחזרה", steps: ["בקשת המלצה", "שמירת קשר", "חזרה"] },
  ];

  // Questions that moved from a domain to a journey step (text unchanged).
  const MOVED_QS = {
    "מאיפה הגיעו 5 הלקוחות האחרונים?": { from: "marketing", to: "j1.0" },
    "מי עוד פוגש את הלקוחות שלך לפניך – ויכול להפנות?": { from: "marketing", to: "j1.0" },
    "מה אנשים אומרים עליך כשהם ממליצים? באילו מילים?": { from: "marketing", to: "j1.1" },
    "כשמישהו רואה מודעה או הודעה שלך ומתעניין – מה בדיוק הוא אמור לעשות עכשיו?": { from: "marketing", to: "j1.3" },
    "תתאר שיחה עם פונה מהרגע שהוא מתקשר ועד שהוא אומר כן.": { from: "sales", to: "j2.1" },
    "מתי נאמר לך לאחרונה \"יקר לי\" – ומה ענית?": { from: "sales", to: "j2.2" },
    "מה קורה עם מי שלא סגר? מי מתקשר, מתי?": { from: "sales", to: "j2.4" },
    "מה אתה מבטיח ללקוח בשיחת המכירה – והאם זה תמיד קורה בפועל?": { from: "sales", to: "j3.1" },
    "מתי הלקוח משלם – מראש, מקדמה, או רק אחרי שהשירות נגמר?": { from: "sales", to: "j3.2" },
    "מי חייב לך כסף עכשיו, כמה, ומאיזה חודש?": { from: "money", to: "j3.2" },
    "מה קורה עם לקוח אחרי שסיים? יש קשר? מי מהם חזר או המליץ השנה, ויש לך המלצות כתובות או מוקלטות?": { from: "marketing", to: "j4.0" },
  };
  // Per journey step: the questions that live there (derived from MOVED_QS — single source of truth).
  const JOURNEY_QS = {};
  JOURNEYS.forEach((j) => j.steps.forEach((_, i) => { JOURNEY_QS[j.id + "." + i] = []; }));
  for (const [q, m] of Object.entries(MOVED_QS)) JOURNEY_QS[m.to].push(q);
  // Removed as a duplicate; its answer (if any) moves to the domain's private free notes (D.notes) – never a client note.
  const REMOVED_QS = { "מה עשית השבוע שמישהו אחר היה יכול לעשות?": { from: "team" } };

  const ST_NAME = { ok: "עובד", weak: "חלש", missing: "חסר", unknown: "לא ידוע" };
  // Old stage index → journey step, for stages that map 1:1.
  const STAGE_MAP = {
    marketing: { 1: "j1.0", 2: "j1.1", 3: "j1.3", 4: "j4.0" },
    sales: { 0: "j2.0", 1: "j2.1", 2: "j2.2", 3: "j2.3", 4: "j2.4" },
  };
  // Old (pre-journey) stage lists, for note labels and for the old 5-stage prefill shape.
  const OLD_STAGES = {
    marketing: ["מי הלקוח", "איפה הוא נמצא", "מה הוא שומע עלינו", "פנייה", "חוזר וממליץ"],
    sales: ["פנייה", "שיחת היכרות", "הצעה ומחיר", "סגירה", "מעקב אחרי מי שלא סגר"],
  };
  const DOM_HE = { marketing: "שיווק", sales: "מכירות" };
  const PRODUCT_DROPPED_STAGE = 3; // "מה מרוויח" – only in the old 5-stage product list
  const PRODUCT_OLD_LEN = 5;

  let seq = 0;
  const uid = (p) => p + Date.now().toString(36) + (seq++).toString(36);
  const txt = (v) => (typeof v === "string" ? v.trim() : "");

  function newRec({ title = "", domainId = null, step = null, status = "active" } = {}) {
    return { id: uid("r"), title, domainId, step, why: { text: "", blocker: "", resource: "", rule: null }, status, returnWhen: "", tasks: [], myView: "" };
  }
  function newTask(recId) { // recId only names the owner; the task is stored inside rec.tasks
    return { id: uid("t"), what: "", firstStep: "", pro: null, due: "", status: "todo", msIdx: null };
  }
  function newDilemma() { return { id: uid("d"), q: "", needed: "", returnWhen: "", status: "open", decision: "" }; }
  function newNote(text) { return { id: uid("n"), text: text || "", at: new Date().toISOString() }; }

  function freshJourney() {
    return JOURNEYS.map((j) => ({ id: j.id, name: j.name, steps: j.steps.map((name) => ({ name, state: "unknown", note: "", answers: {} })) }));
  }
  function stepOf(S, ref) {
    const [jid, i] = String(ref).split(".");
    const j = (S.journey || []).find((x) => x.id === jid);
    return j ? j.steps[+i] || null : null;
  }

  // A v2 state must always have its lists (a damaged/partial save must not crash the views).
  function ensure(S) {
    if (!S) return S;
    if (!Array.isArray(S.journey)) S.journey = freshJourney();
    if (!Array.isArray(S.recs)) S.recs = [];
    if (!Array.isArray(S.dilemmas)) S.dilemmas = [];
    if (!Array.isArray(S.notes)) S.notes = [];
    return S;
  }

  function migrate(S) {
    if (!S) return S;
    if (S.planV === 2) return ensure(S);
    const notes = Array.isArray(S.notes) ? S.notes : [];
    const addNote = (t) => notes.push(newNote(t));
    if (!Array.isArray(S.journey)) S.journey = freshJourney();
    if (!Array.isArray(S.recs)) S.recs = [];
    if (!Array.isArray(S.dilemmas)) S.dilemmas = [];
    S.notes = notes;
    const doms = S.domains || {};

    // Marketing / sales stages → journey steps.
    for (const did of ["marketing", "sales"]) {
      const D = doms[did];
      if (!D || !Array.isArray(D.stages)) continue;
      D.stages.forEach((s, i) => {
        if (!s) return;
        const ref = STAGE_MAP[did][i];
        const target = ref && stepOf(S, ref);
        if (target) {
          target.state = s.state || "unknown";
          target.note = s.note || "";
        } else {
          // "מי הלקוח" (marketing 0) has no step.
          const state = s.state && s.state !== "unknown" ? ST_NAME[s.state] || s.state : "";
          const body = [state, txt(s.note)].filter(Boolean).join(" ");
          if (body) addNote(DOM_HE[did] + " · " + (OLD_STAGES[did][i] || "שלב " + (i + 1)) + ": " + body);
        }
      });
      delete D.stages;
    }

    // Product loses "מה מרוויח".
    const P = doms.product;
    if (P && Array.isArray(P.stages) && P.stages.length === PRODUCT_OLD_LEN) {
      const [gone] = P.stages.splice(PRODUCT_DROPPED_STAGE, 1);
      if (gone && txt(gone.note)) addNote("מוצרים · מה מרוויח: " + txt(gone.note));
    }

    // Moved questions. map.html keys base-question answers (and qEdits) as "b:" + text; plain text accepted too.
    // In a journey step the key is the plain question text.
    const keyOf = (D, q) => ["b:" + q, q].find((k) => D && D.answers && txt(D.answers[k]));
    const dropEdit = (D, q) => {
      const e = D.qEdits && (D.qEdits["b:" + q] ?? D.qEdits[q]);
      if (D.qEdits) { delete D.qEdits["b:" + q]; delete D.qEdits[q]; }
      return e;
    };
    for (const [q, m] of Object.entries(MOVED_QS)) {
      const D = doms[m.from];
      const k = keyOf(D, q);
      if (!k) continue;
      const target = stepOf(S, m.to);
      target.answers[q] = D.answers[k];
      delete D.answers[k];
      const e = dropEdit(D, q);
      if (txt(e)) (target.qEdits = target.qEdits || {})[q] = e;
    }
    for (const [q, m] of Object.entries(REMOVED_QS)) {
      const D = doms[m.from];
      const k = keyOf(D, q);
      if (!k) continue;
      const e = dropEdit(D, q);
      const line = (txt(e) || q) + " → " + D.answers[k];
      D.notes = typeof D.notes === "string" && D.notes.trim() ? D.notes.replace(/\s+$/, "") + "\n" + line : line;
      delete D.answers[k];
    }

    // Old summary lists → notes and frozen recs.
    const Sm = S.summary || {};
    const rowNote = (label, b) => {
      if (!b || !txt(b.text) && !txt(b.rec)) return;
      addNote(label + ": " + [txt(b.text), txt(b.rec)].filter(Boolean).join(" – "));
    };
    (Sm.blockers || []).forEach((b) => rowNote("חסם", b));
    (Sm.resources || []).forEach((b) => rowNote("משאב", b));
    (Sm.frozen || []).forEach((f) => {
      if (!f || !txt(f.item) && !txt(f.reason) && !txt(f.condition)) return;
      const r = newRec({ title: f.item || "", status: "frozen" });
      r.why.text = f.reason || "";
      r.returnWhen = f.condition || "";
      S.recs.push(r);
    });
    delete Sm.blockers;
    delete Sm.resources;
    delete Sm.frozen;

    S.planV = 2;
    return S;
  }

  function sortNote(S, noteId, target) {
    const i = (S.notes || []).findIndex((n) => n.id === noteId);
    if (i < 0 || !target) return null;
    const note = S.notes[i];
    let made = null;
    if (target.kind === "rec") {
      made = newRec({ title: note.text, domainId: target.domainId || null });
      (S.recs = S.recs || []).push(made);
    } else if (target.kind === "dilemma") {
      made = newDilemma();
      made.q = note.text;
      (S.dilemmas = S.dilemmas || []).push(made);
    } else if (target.kind === "known") {
      const D = S.domains && S.domains[target.domainId];
      if (!D) return null;
      (D.known = D.known || []).push(note.text);
      made = note.text;
    } else if (target.kind !== "delete") {
      return null;
    }
    S.notes.splice(i, 1);
    return made;
  }

  // Dilemmas for the tab: open ones first, decided ones (folded) at the bottom; order kept within each.
  function dilemmaSplit(S) {
    const all = S.dilemmas || [];
    return { open: all.filter((d) => d.status !== "decided"), decided: all.filter((d) => d.status === "decided") };
  }
  // Notes newest first (by "at"; equal/missing times keep reverse insertion order).
  function notesNewest(S) {
    return (S.notes || []).map((n, i) => [n, i])
      .sort((a, b) => String(b[0].at || "").localeCompare(String(a[0].at || "")) || b[1] - a[1])
      .map(([n]) => n);
  }

  function pickPro(task, pro) {
    task.pro = pro ? { id: pro.id, name: pro.name, field: pro.field, phone: pro.phone } : null;
    return task;
  }
  function pickRule(rec, rule) {
    rec.why.rule = rule ? { id: rule.id, title: rule.title, body: rule.body } : null;
    return rec;
  }

  // Delete milestone i of active domain activeIdx; tasks of that domain follow (pointing at it → null, after it → shift down).
  function removeMilestone(S, activeIdx, i) {
    const a = ((S.summary || {}).active || [])[activeIdx];
    if (!a || !Array.isArray(a.milestones) || i < 0 || i >= a.milestones.length) return false;
    a.milestones.splice(i, 1);
    (S.recs || []).filter((r) => r.domainId === a.domainId).forEach((r) => (r.tasks || []).forEach((t) => {
      if (t.msIdx == null) return;
      if (t.msIdx === i) t.msIdx = null; else if (t.msIdx > i) t.msIdx -= 1;
    }));
    return true;
  }

  // Delete step stepIdx of journey journeyIdx; recs follow (pointing at it → null, later steps of that journey → shift down).
  function removeStep(S, journeyIdx, stepIdx) {
    const j = (S.journey || [])[journeyIdx];
    if (!j || !Array.isArray(j.steps) || stepIdx < 0 || stepIdx >= j.steps.length) return false;
    j.steps.splice(stepIdx, 1);
    (S.recs || []).forEach((r) => {
      if (typeof r.step !== "string") return;
      const [jid, i] = r.step.split(".");
      if (jid !== j.id) return;
      if (+i === stepIdx) r.step = null; else if (+i > stepIdx) r.step = jid + "." + (+i - 1);
    });
    return true;
  }

  // Does an active domain hold anything typed (goal, measure, milestones, my view)?
  function activeHasContent(a) {
    if (!a) return false;
    if (["goal", "target", "start", "unit", "myView"].some((k) => txt(a[k]))) return true;
    return (a.milestones || []).some((m) => m && txt(m.title));
  }
  // Take a domain off the active list; its tasks lose their milestone link (the milestones go with it).
  function deactivateDomain(S, domainId) {
    const Sm = S.summary || {};
    Sm.active = (Sm.active || []).filter((a) => a.domainId !== domainId);
    (S.recs || []).filter((r) => r.domainId === domainId).forEach((r) => (r.tasks || []).forEach((t) => { t.msIdx = null; }));
  }

  // Stage list for a fresh map from the questionnaire prefill (cStages: state strings).
  // Marketing/sales/product prefill may still be in the old 5-stage shape: keep it whole so migrate() maps it
  // (marketing/sales → journey, product drops "מה מרוויח").
  function prefillStages(domId, defStages, cStages) {
    const c = Array.isArray(cStages) ? cStages : [];
    const old = (domId === "marketing" || domId === "sales" || domId === "product") && c.length === PRODUCT_OLD_LEN && (defStages || []).length !== PRODUCT_OLD_LEN;
    return (old ? c : defStages || []).map((_, i) => ({ state: c[i] || "unknown", note: "" }));
  }

  function goalProgress(S, activeIdx) {
    const a = ((S.summary || {}).active || [])[activeIdx];
    if (!a) return { done: 0, total: 0, by: "tasks" };
    const ms = (a.milestones || []).filter((m) => m && txt(m.title));
    if (ms.length) return { done: ms.filter((m) => m.done === true).length, total: ms.length, by: "milestones" };
    const tasks = (S.recs || []).filter((r) => r.domainId === a.domainId && r.status !== "frozen").flatMap((r) => r.tasks || []);
    return { done: tasks.filter((t) => t.status === "done").length, total: tasks.length, by: "tasks" };
  }

  // ---- export (client-safe plan) and recap sections ----
  // Whitelisted copy only: no myView, answers, scores, reasons, qEdits, professionals list or rules list.
  const idName = (id) => id;
  function exportPlan(S, domName = idName) {
    const V = S.vision || {}, Sm = S.summary || {};
    return {
      vision: V.vision || "", bigGoal: V.bigGoal || "", goal90: V.goal90 || "",
      domains: (Sm.active || []).map((a) => ({
        id: a.domainId, name: domName(a.domainId) || a.domainId, goal: a.goal || "", target: a.target || "",
        kind: a.kind || "count", start: a.start || "", unit: a.unit || "",
        milestones: (a.milestones || []).map((m) => ({ title: (m && m.title) || "", date: (m && m.date) || "", done: !!(m && m.done) })),
      })),
      journey: (S.journey || []).map((j) => ({ id: j.id, name: j.name, steps: (j.steps || []).map((st) => ({ name: st.name, state: st.state || "unknown", note: st.note || "" })) })),
      recs: (S.recs || []).map((r) => ({
        id: r.id, title: r.title || "", domainId: r.domainId || null, step: r.step || null, status: r.status || "active", returnWhen: r.returnWhen || "",
        why: { text: (r.why && r.why.text) || "", blocker: (r.why && r.why.blocker) || "", resource: (r.why && r.why.resource) || "",
          rule: r.why && r.why.rule ? { title: r.why.rule.title || "", body: r.why.rule.body || "" } : null },
        tasks: (r.tasks || []).map((t) => ({ id: t.id, what: t.what || "", firstStep: t.firstStep || "", due: t.due || "", status: t.status || "todo", msIdx: t.msIdx == null ? null : t.msIdx,
          pro: t.pro ? { name: t.pro.name || "", field: t.pro.field || "", phone: t.pro.phone || "" } : null })),
      })),
      dilemmas: (S.dilemmas || []).map((d) => ({ id: d.id, q: d.q || "", needed: d.needed || "", returnWhen: d.returnWhen || "", status: d.status || "open", decision: d.decision || "" })),
      notes: (S.notes || []).map((n) => ({ text: n.text || "", at: n.at || "" })),
    };
  }

  // Recap: journey steps that work / are weak / missing (with the step note). Null when nothing was marked.
  function recapJourney(S) {
    const groups = [];
    (S.journey || []).forEach((j) => {
      const steps = j.steps || [];
      const lines = [j.name];
      const ok = steps.filter((st) => st.state === "ok").map((st) => st.name);
      if (ok.length) lines.push("עובד: " + ok.join(" · "));
      steps.filter((st) => st.state === "weak" || st.state === "missing")
        .forEach((st) => lines.push(ST_NAME[st.state] + " – " + st.name + (txt(st.note) ? ": " + txt(st.note) : "")));
      steps.filter((st) => st.state === "ok" && txt(st.note)).forEach((st) => lines.push(st.name + ": " + txt(st.note)));
      if (lines.length > 1) groups.push(lines);
    });
    return groups.length ? { title: "מסע הלקוח – איפה נופלים", groups } : null;
  }

  // Recap: active recs with tasks, ideas bank titles, open dilemmas, unsorted notes (empty sections left out).
  function recapPlan(S, domName = idName) {
    const out = [];
    const where = (r) => {
      if (r.domainId) return domName(r.domainId) || r.domainId;
      const st = r.step ? stepOf(S, r.step) : null;
      return st ? st.name : "";
    };
    const recs = S.recs || [];
    const act = recs.filter((r) => r.status !== "frozen" && txt(r.title)).map((r) => {
      const w = where(r), y = r.why || {};
      const lines = [r.title + (w ? " (" + w + ")" : "")];
      if (txt(y.text)) lines.push("למה: " + txt(y.text));
      if (txt(y.blocker)) lines.push("חסם: " + txt(y.blocker));
      if (txt(y.resource)) lines.push("משאב: " + txt(y.resource));
      if (y.rule && txt(y.rule.title)) lines.push("כלל: " + txt(y.rule.title));
      (r.tasks || []).filter((t) => txt(t.what)).forEach((t) => lines.push("משימה: " + [txt(t.what),
        txt(t.firstStep) && "צעד ראשון: " + txt(t.firstStep), t.pro && txt(t.pro.name) && "עם " + txt(t.pro.name),
        txt(t.due) && "עד " + txt(t.due), t.status === "done" && "בוצע ✓"].filter(Boolean).join(" – ")));
      return lines;
    });
    if (act.length) out.push({ title: "המלצות ומשימות", groups: act });
    const ideas = recs.filter((r) => r.status === "frozen" && txt(r.title)).map((r) => txt(r.title));
    if (ideas.length) out.push({ title: "מאגר רעיונות", items: ideas });
    const dil = dilemmaSplit(S).open.filter((d) => txt(d.q)).map((d) => txt(d.q) + (txt(d.needed) ? " – מה חסר: " + txt(d.needed) : "") + (txt(d.returnWhen) ? " (חוזרים כש" + txt(d.returnWhen) + ")" : ""));
    if (dil.length) out.push({ title: "דילמות פתוחות", items: dil });
    const notes = (S.notes || []).filter((n) => txt(n.text)).map((n) => txt(n.text));
    if (notes.length) out.push({ title: "פתקים שעוד לא מוינו", items: notes });
    return out;
  }

  globalThis.PlanModel = { JOURNEYS, MOVED_QS, JOURNEY_QS, REMOVED_QS, ST_NAME, migrate, ensure, newRec, newTask, newDilemma, newNote, sortNote, dilemmaSplit, notesNewest, pickPro, pickRule, removeMilestone, removeStep, activeHasContent, deactivateDomain, prefillStages, goalProgress, stepOf, exportPlan, recapJourney, recapPlan };
})();
