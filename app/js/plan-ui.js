/* Plan UI (planV 2): customer-journey, plan (recommendations, tasks, ideas bank), dilemmas and notes tabs, floating "+ פתק".
   Classic script, loaded before the map script. Uses the map's globals at call time
   (S, h, inp, ta, touch, render, ALL, mine, goalBox, endOfMonth, ST_ORDER, ST_NAME).
   Admin-only lists come from window.__PROS / window.__RULES (loaded by the map's loader module).
   Pure helpers are exposed on globalThis.PlanUI. */
(function () {
  "use strict";

  // Which default step a journey step is (e.g. "j2.3"), so its questions follow it even after
  // steps are added, deleted or renamed. Matched once by the default name, then stored on the step.
  function stepRef(j, st) {
    if (typeof st.ref === "string") return st.ref;
    const def = (globalThis.PlanModel.JOURNEYS.find((x) => x.id === j.id) || { steps: [] }).steps;
    const i = def.indexOf(st.name);
    st.ref = i >= 0 ? j.id + "." + i : "";
    return st.ref;
  }
  // The questions shown in a step: its default questions, plus any question that already has an answer there.
  function stepQs(j, st) {
    const base = globalThis.PlanModel.JOURNEY_QS[stepRef(j, st)] || [];
    const extra = Object.keys(st.answers || {}).filter((q) => !base.includes(q));
    return [...base, ...extra];
  }

  function ask(text, yes, onYes) {
    const box = h("div", { class: "confirm" },
      h("div", {}, h("p", {}, text),
        h("div", { class: "row" },
          h("button", { class: "tool", onclick: () => box.remove() }, "ביטול"),
          h("button", { class: "tool on", onclick: () => { box.remove(); onYes(); } }, yes))));
    document.body.append(box);
  }

  function chip(st) {
    const b = h("button", { class: "jchip st-" + st.state, title: "לחיצה מחליפה מצב" }, ST_NAME[st.state] || st.state);
    b.onclick = () => {
      st.state = ST_ORDER[(ST_ORDER.indexOf(st.state) + 1) % ST_ORDER.length];
      b.className = "jchip st-" + st.state; b.textContent = ST_NAME[st.state];
      touch();
    };
    return b;
  }

  function stepRow(j, st, i) {
    st.answers = st.answers || {};
    const name = h("b", { contenteditable: "true", title: "אפשר לשנות את שם הצעד" }, st.name);
    name.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); name.blur(); } }); // one line only
    name.addEventListener("input", () => { st.name = name.textContent.replace(/[\r\n]+/g, " "); touch(); });
    const del = h("button", { class: "del", title: "מחיקת הצעד", onclick: () =>
      ask("למחוק את הצעד \"" + (st.name || "") + "\"? מה שנכתב בו יימחק.", "כן, למחוק", () => { globalThis.PlanModel.removeStep(S, S.journey.indexOf(j), i); touch(); render(); }) }, "✕");
    const qs = stepQs(j, st).map((q) => {
      const t = h("textarea", { rows: 2, placeholder: "תשובה" }); t.value = st.answers[q] || "";
      t.addEventListener("input", () => { st.answers[q] = t.value; touch(); });
      return h("div", { class: "q" }, h("label", {}, (st.qEdits && st.qEdits[q]) || q), t);
    });
    return h("div", { class: "jstep" },
      h("div", { class: "jhead" }, name, chip(st), del),
      inp(st, "note", "מה קורה כאן אצלו?"),
      qs.length ? h("div", { class: "jqs layer-q" }, qs) : null);
  }

  function viewJourney() {
    globalThis.PlanModel.migrate(S); // a v2 state with a missing/broken journey is rebuilt (ensure)
    const cards = S.journey.map((j) => h("div", { class: "box jcard" },
      h("h3", {}, j.name),
      j.steps.map((st, i) => stepRow(j, st, i)),
      h("button", { class: "add", onclick: () => { j.steps.push({ name: "צעד חדש", state: "unknown", note: "", answers: {}, ref: "" }); touch(); render(); } }, "+ צעד")));
    return h("section", {},
      h("h1", {}, "מסע הלקוח"),
      h("p", { class: "note jtop" }, "מסמנים איפה הלקוחות נופלים. בלי ציון."),
      h("div", { class: "jgrid" }, cards));
  }

  /* ---------- plan tab ---------- */
  // Rule id → domain, from "כללי ציון ושאלות.md" (section "איפה כל כלל נבדק", 17.11). Unmapped rules → "כללי".
  const RULE_DOMAIN = {
    1: "marketing", 2: "marketing", 5: "marketing", 10: "marketing", 15: "marketing", 20: "marketing", 21: "marketing", 22: "marketing", 24: "marketing",
    3: "sales", 11: "sales", 13: "sales",
    12: "product", 18: "product", 19: "product", 25: "product",
    8: "money", 14: "money",
    16: "team",
    7: "owner", 9: "owner", 17: "owner", 26: "owner",
  };
  const TASK_ST = { todo: "לא התחיל", doing: "בעבודה", done: "בוצע", postponed: "נדחה" };
  const GENERAL = "כללי";

  // Journey steps as select options: [{ref:"j2.3", name, journey}].
  function stepOptions(S) {
    return (S.journey || []).flatMap((j) => (j.steps || []).map((st, i) => ({ ref: j.id + "." + i, name: st.name, journey: j.name })));
  }
  // Ideas-bank category: the domain name; else the journey step name; else "כללי".
  function recCategory(S, rec, domName) {
    const dn = rec.domainId ? domName(rec.domainId) : "";
    if (dn) return dn;
    const st = rec.step ? globalThis.PlanModel.stepOf(S, rec.step) : null;
    return st && st.name ? st.name : GENERAL;
  }
  // Frozen recs grouped by category, in first-seen order, "כללי" last: [[category, recs]].
  function ideaGroups(S, domName) {
    const m = new Map();
    (S.recs || []).filter((r) => r.status === "frozen").forEach((r) => {
      const c = recCategory(S, r, domName);
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(r);
    });
    const out = [...m.entries()];
    return [...out.filter(([c]) => c !== GENERAL), ...out.filter(([c]) => c === GENERAL)];
  }
  // A frozen rec made from a master rule ("+ כלל לכל הלקוח").
  function ruleRec(rule) {
    const PM = globalThis.PlanModel;
    const rec = PM.newRec({ title: rule.title, domainId: RULE_DOMAIN[rule.id] || null, status: "frozen" });
    return PM.pickRule(rec, rule);
  }

  const domName = (id) => ((ALL().find((d) => d.id === id) || {}).name || "");
  const openMs = new Set(); // domains whose milestones box is open (kept across redraws)
  function redraw() { const y = window.scrollY; render(); window.scrollTo(0, y); }

  function modal(title, ...body) {
    const box = h("div", { class: "pmodal" },
      h("div", {}, h("h3", {}, title), ...body,
        h("div", { class: "row" }, h("button", { class: "tool", onclick: () => box.remove() }, "סגירה"))));
    box.addEventListener("click", (e) => { if (e.target === box) box.remove(); });
    document.body.append(box);
    return box;
  }

  function rulePicker(onPick) {
    const rules = window.__RULES || [];
    const groups = new Map();
    rules.forEach((r) => { if (!groups.has(r.grp)) groups.set(r.grp, []); groups.get(r.grp).push(r); });
    const list = rules.length ? [...groups.entries()].map(([g, rs]) => h("div", { class: "rgrp" }, h("h4", {}, g),
      rs.map((r) => h("button", { class: "rpick", title: r.body || "", onclick: () => { box.remove(); onPick(r); } }, r.id + " · " + r.title))))
      : [h("p", { class: "note" }, "רשימת הכללים לא נטענה (אין חיבור לאינטרנט?)")];
    const box = modal("בחירת כלל", h("div", { class: "rlist" }, list));
  }

  function proPicker(task) {
    const PM = globalThis.PlanModel, pros = window.__PROS || [], cur = task.pro;
    const label = (p) => (p.name || "") + (p.field ? " – " + p.field : "");
    const sel = h("select", { title: "למי פונים" });
    const opts = [["", "— למי פונים —"], ...pros.map((p) => [p.id, label(p)])];
    if (cur && cur.id && !pros.some((p) => p.id === cur.id)) opts.push([cur.id, label(cur)]); // kept copy (e.g. deleted from the list)
    opts.push(["__other", "אחר…"]);
    opts.forEach(([v, n]) => sel.append(h("option", { value: v }, n)));
    sel.value = !cur ? "" : cur.id ? cur.id : "__other";
    const other = h("input", { placeholder: "שם ופרטים" });
    other.value = cur && !cur.id ? cur.name || "" : "";
    other.hidden = sel.value !== "__other";
    if (cur && cur.phone) sel.title = cur.phone;
    sel.addEventListener("change", () => {
      const v = sel.value;
      if (v === "__other") { task.pro = { name: other.value }; other.hidden = false; other.focus(); }
      else {
        other.hidden = true;
        const p = pros.find((x) => x.id === v);
        if (p) PM.pickPro(task, p); else if (cur && cur.id && v === cur.id) task.pro = cur; else if (!v) PM.pickPro(task, null);
      }
      touch();
    });
    other.addEventListener("input", () => { task.pro = { name: other.value }; touch(); });
    return h("span", { class: "pro" }, sel, other);
  }

  function select(pairs, value, onChange, title) {
    const sel = h("select", { title: title || "" });
    pairs.forEach(([v, n]) => sel.append(h("option", { value: v }, n)));
    sel.value = value == null ? "" : String(value);
    sel.addEventListener("change", () => onChange(sel.value));
    return sel;
  }

  function taskRow(task, rec) {
    const a = ((S.summary || {}).active || []).find((x) => x.domainId === rec.domainId);
    const ms = ((a && a.milestones) || []).map((m, i) => [i, m]).filter(([, m]) => m && (m.title || "").trim());
    const status = select(Object.entries(TASK_ST), task.status || "todo", (v) => { task.status = v; touch(); redraw(); }, "סטטוס");
    const msSel = ms.length ? select([["", "— אבן דרך —"], ...ms.map(([i, m]) => [String(i), m.title])], task.msIdx,
      (v) => { task.msIdx = v === "" ? null : +v; touch(); }, "אבן דרך") : null;
    const del = h("button", { class: "del", title: "מחיקת המשימה", onclick: () => {
      const go = () => { rec.tasks.splice(rec.tasks.indexOf(task), 1); touch(); redraw(); };
      const filled = ["what", "firstStep", "due"].some((k) => (task[k] || "").trim()) || (task.pro && (task.pro.id || (task.pro.name || "").trim()));
      if (filled) ask("למחוק את המשימה" + ((task.what || "").trim() ? " \"" + task.what + "\"" : "") + "?", "כן, למחוק", go); else go();
    } }, "✕");
    return h("div", { class: "task st-" + (task.status || "todo") },
      inp(task, "what", "מה עושים"), inp(task, "firstStep", "צעד ראשון"), proPicker(task),
      h("label", { class: "due" }, "עד מתי", inp(task, "due", "", "date")), status, msSel, del);
  }

  function ruleTag(rec, onRemove) {
    const r = rec.why && rec.why.rule;
    if (!r) return null;
    return h("span", { class: "rtag", title: r.body || "" }, "כלל " + r.id + " · " + r.title,
      onRemove ? h("button", { class: "del", title: "להסיר את הכלל", onclick: onRemove }, "✕") : null);
  }

  function recCard(rec, showDomain) {
    const PM = globalThis.PlanModel;
    rec.why = rec.why || { text: "", blocker: "", resource: "", rule: null };
    rec.tasks = Array.isArray(rec.tasks) ? rec.tasks : [];
    const ruleBox = h("span", {});
    const drawRule = () => { ruleBox.innerHTML = ""; const t = ruleTag(rec, () => { PM.pickRule(rec, null); touch(); drawRule(); }); if (t) ruleBox.append(t); };
    drawRule();
    const steps = stepOptions(S);
    const stepSel = h("select", { title: "צעד במסע הלקוח" }, h("option", { value: "" }, "—"),
      (S.journey || []).map((j) => h("optgroup", { label: j.name },
        steps.filter((o) => o.ref.split(".")[0] === j.id).map((o) => h("option", { value: o.ref }, o.name)))));
    stepSel.value = rec.step || "";
    stepSel.addEventListener("change", () => { rec.step = stepSel.value || null; touch(); });
    const state = h("div", { class: "kinds" }, [["active", "פעיל"], ["frozen", "מוקפא"]].map(([k, n]) =>
      h("button", { class: rec.status === k ? "on" : "", onclick: () => { rec.status = k; touch(); redraw(); } }, n)));
    const del = h("button", { class: "del", title: "מחיקת ההמלצה", onclick: () =>
      ask("למחוק את ההמלצה \"" + (rec.title || "") + "\" וכל המשימות שלה?", "כן, למחוק", () => { S.recs.splice(S.recs.indexOf(rec), 1); touch(); redraw(); }) }, "✕");
    return h("div", { class: "rec" },
      h("div", { class: "rhead" }, inp(rec, "title", "מה ממליצים"), state, del),
      showDomain && rec.domainId && domName(rec.domainId) ? h("span", { class: "tag" }, domName(rec.domainId)) : null,
      h("div", { class: "rwhy" }, h("label", {}, "למה"), inp(rec.why, "text", "למה זה חשוב"),
        h("input", { class: "sm", placeholder: "חסם", value: rec.why.blocker || "", oninput: (e) => { rec.why.blocker = e.target.value; touch(); } }),
        h("input", { class: "sm", placeholder: "משאב", value: rec.why.resource || "", oninput: (e) => { rec.why.resource = e.target.value; touch(); } }),
        h("button", { class: "add", onclick: () => rulePicker((r) => { PM.pickRule(rec, r); touch(); drawRule(); }) }, "כלל"), ruleBox),
      h("div", { class: "rmeta" }, h("label", {}, "צעד במסע"), stepSel,
        rec.status === "frozen" ? h("label", {}, "מתי חוזרים") : null, rec.status === "frozen" ? inp(rec, "returnWhen", "מתי חוזרים לזה") : null),
      mine(rec, "myView"),
      h("div", { class: "tasks" }, rec.tasks.map((t) => taskRow(t, rec))),
      h("button", { class: "add", onclick: () => { rec.tasks.push(PM.newTask(rec.id)); touch(); redraw(); } }, "+ משימה"));
  }

  function domainBlock(a, ai) {
    const PM = globalThis.PlanModel;
    const d = ALL().find((x) => x.id === a.domainId);
    if (!d) return null;
    a.milestones = Array.isArray(a.milestones) ? a.milestones : [];
    const titled = a.milestones.filter((m) => m && (m.title || "").trim()).length;
    const msRows = a.milestones.map((m, i) => {
      const cb = h("input", { type: "checkbox", title: "הושג" }); cb.checked = m.done === true;
      cb.addEventListener("change", () => { m.done = cb.checked; touch(); redraw(); });
      return h("div", { class: "ms" }, h("span", {}, "אבן דרך " + (i + 1)), inp(m, "title", "מה יושג"), inp(m, "date", "", "date"), cb,
        h("button", { class: "del", title: "מחיקת אבן הדרך", onclick: () => {
          const go = () => { PM.removeMilestone(S, ai, i); touch(); redraw(); };
          if ((m.title || "").trim()) ask("למחוק את אבן הדרך \"" + m.title + "\"? משימות שמשויכות אליה יישארו בלי אבן דרך.", "כן, למחוק", go); else go();
        } }, "✕"));
    });
    const ms = h("details", { class: "msbox" }, h("summary", {}, "אבני דרך" + (titled ? " (" + titled + ")" : "")), msRows,
      h("button", { class: "add", onclick: () => { a.milestones.push({ title: "", date: endOfMonth(a.milestones.length), done: false }); openMs.add(a.domainId); touch(); redraw(); } }, "+ אבן דרך"));
    ms.open = openMs.has(a.domainId);
    ms.addEventListener("toggle", () => { if (ms.open) openMs.add(a.domainId); else openMs.delete(a.domainId); });
    let prog = null;
    if (a.kind === "steps") {
      const g = PM.goalProgress(S, ai);
      prog = h("p", { class: "prog" }, "התקדמות: " + g.done + " מתוך " + g.total + (g.by === "milestones" ? " אבני דרך" : " משימות"));
    }
    const recs = S.recs.filter((r) => r.domainId === a.domainId && r.status !== "frozen");
    return h("div", { class: "active-dom" }, h("h3", {}, d.name),
      h("div", { class: "cols", style: "gap:12px;margin:8px 0" }, h("div", { class: "q" }, h("label", {}, "מטרה"), ta(a, "goal", "מה רוצים להשיג, במילים", 2)), goalBox(a)),
      prog, ms, mine(a, "myView"),
      h("div", { class: "recs" }, recs.map((r) => recCard(r))),
      h("button", { class: "add", onclick: () => { S.recs.push(PM.newRec({ domainId: a.domainId })); touch(); redraw(); } }, "+ המלצה"));
  }

  function ideaRow(rec) {
    const del = h("button", { class: "del", title: "מחיקת הרעיון", onclick: () =>
      ask("למחוק את הרעיון \"" + (rec.title || "") + "\"?", "כן, למחוק", () => { S.recs.splice(S.recs.indexOf(rec), 1); touch(); redraw(); }) }, "✕");
    rec.why = rec.why || { text: "", blocker: "", resource: "", rule: null };
    return h("div", { class: "idea" },
      inp(rec, "title", "הרעיון"), inp(rec.why, "text", "למה"), inp(rec, "returnWhen", "מתי חוזרים"),
      h("button", { class: "tool", onclick: () => { rec.status = "active"; touch(); redraw(); } }, "להפעיל"), del,
      ruleTag(rec));
  }

  function addIdea(live) {
    const sel = h("select", {}, h("option", { value: "" }, GENERAL), live.map((d) => h("option", { value: d.id }, d.name)));
    const title = h("input", { placeholder: "הרעיון" });
    const go = () => {
      S.recs.push(globalThis.PlanModel.newRec({ title: title.value.trim(), domainId: sel.value || null, status: "frozen" }));
      box.remove(); touch(); redraw();
    };
    title.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    const box = modal("רעיון חדש", h("div", { class: "q" }, h("label", {}, "קטגוריה"), sel),
      h("div", { class: "q" }, h("label", {}, "הרעיון"), title), h("button", { class: "tool on", onclick: go }, "הוספה"));
    title.focus();
  }

  function viewPlan() {
    const PM = globalThis.PlanModel;
    PM.migrate(S);
    const Sm = S.summary = S.summary || {};
    Sm.active = Array.isArray(Sm.active) ? Sm.active : [];
    const V = S.vision = S.vision || {};
    const live = ALL().filter((d) => !(S.removed || []).includes(d.id));
    const head = h("div", { class: "box phead" },
      h("div", { class: "q" }, h("label", {}, "חזון"), ta(V, "vision", "איזה עסק, באיזה תחום, למי", 2)),
      h("div", { class: "q" }, h("label", {}, "מטרה גדולה"), ta(V, "bigGoal", "מספר + זמן", 2)),
      h("div", { class: "q" }, h("label", {}, "מטרת 90 יום"), ta(V, "goal90", "תוצאה מדידה", 2)));
    const pick = h("div", { class: "dpick" }, live.map((d) => {
      const on = Sm.active.some((a) => a.domainId === d.id);
      return h("button", { class: on ? "on" : "", onclick: () => {
        if (on) {
          const go = () => { PM.deactivateDomain(S, d.id); touch(); redraw(); };
          const a = Sm.active.find((x) => x.domainId === d.id);
          if (PM.activeHasContent(a)) ask("להוציא את \"" + d.name + "\" מהתחומים הפעילים? המטרה, המדידה, אבני הדרך ומה שכתבת עליו יימחקו. ההמלצות והמשימות נשארות.", "כן, להוציא", go);
          else go();
          return;
        }
        Sm.active.push({ domainId: d.id, goal: "", target: "", milestones: [], myView: "" });
        touch(); redraw();
      } }, d.name + " (" + ((S.domains[d.id] || {}).score ?? "") + ")");
    }));
    const act = Sm.active.map((a, i) => domainBlock(a, i)).filter(Boolean);
    const general = S.recs.filter((r) => r.status !== "frozen" && (!r.domainId || !Sm.active.some((a) => a.domainId === r.domainId)));
    const groups = ideaGroups(S, domName);
    const ideas = h("details", { class: "box ideas", open: true },
      h("summary", {}, h("h3", {}, "מאגר רעיונות וכיוונים")),
      groups.length ? groups.map(([c, rs]) => h("div", { class: "igrp" }, h("h4", {}, c), rs.map(ideaRow)))
        : h("p", { class: "note" }, "עדיין אין רעיונות מוקפאים."),
      h("div", { class: "row iadd" },
        h("button", { class: "add", onclick: () => addIdea(live) }, "+ רעיון"),
        h("button", { class: "add", onclick: () => rulePicker((r) => { S.recs.push(ruleRec(r)); touch(); redraw(); }) }, "+ כלל לכל הלקוח")));
    return h("section", {},
      h("h1", {}, "התוכנית"), head,
      h("div", { class: "box", style: "margin-bottom:20px" }, h("h3", {}, "תחומים פעילים"), pick, act.length ? act : h("p", { class: "note" }, "בחר תחומים למעלה.")),
      h("div", { class: "box", style: "margin-bottom:20px" }, h("h3", {}, "המלצות כלליות"),
        h("div", { class: "recs" }, general.map((r) => recCard(r, true))),
        h("button", { class: "add", onclick: () => { S.recs.push(PM.newRec({})); touch(); redraw(); } }, "+ המלצה")),
      ideas,
      mine(Sm, "myView", "מה אני חושב על התוכנית"));
  }

  /* ---------- dilemmas tab ---------- */
  let decidedOpen = false; // the folded "הוכרעו" box stays as the user left it across redraws
  let focusDecision = null; // id of a dilemma just marked decided: its "מה הוחלט" gets focus
  function dilemmaCard(d) {
    const del = h("button", { class: "del", title: "מחיקת הדילמה", onclick: () => {
      const go = () => { const i = S.dilemmas.indexOf(d); if (i >= 0) S.dilemmas.splice(i, 1); touch(); redraw(); };
      if (["q", "needed", "returnWhen", "decision"].some((k) => (d[k] || "").trim())) ask("למחוק את הדילמה" + ((d.q || "").trim() ? " \"" + d.q + "\"" : "") + "?", "כן, למחוק", go); else go();
    } }, "✕");
    const state = h("div", { class: "kinds" }, [["open", "פתוחה"], ["decided", "הוכרעה"]].map(([k, n]) =>
      h("button", { class: (d.status === "decided" ? "decided" : "open") === k ? "on" : "", onclick: () => {
        if (d.status === k) return;
        d.status = k;
        if (k === "decided") { decidedOpen = true; focusDecision = d.id; }
        touch(); redraw();
      } }, n)));
    return h("div", { class: "rec dil" + (d.status === "decided" ? " done" : "") },
      h("div", { class: "rhead" }, inp(d, "q", "השאלה"), state, del),
      h("div", { class: "q" }, h("label", {}, "מה צריך לדעת כדי להכריע"), ta(d, "needed", "", 2)),
      h("div", { class: "q" }, h("label", {}, "מתי חוזרים"), inp(d, "returnWhen", "מתי חוזרים לזה")),
      d.status === "decided" ? h("div", { class: "q" }, h("label", {}, "מה הוחלט"), decisionBox(d)) : null);
  }
  function decisionBox(d) {
    const t = ta(d, "decision", "", 2);
    if (focusDecision === d.id) {
      focusDecision = null;
      setTimeout(() => { if (t.isConnected) { t.scrollIntoView({ block: "center" }); t.focus(); } }, 0);
    }
    return t;
  }

  function viewDilemmas() {
    const PM = globalThis.PlanModel;
    PM.migrate(S);
    const { open, decided } = PM.dilemmaSplit(S);
    return h("section", {},
      h("h1", {}, "דילמות"),
      h("div", { class: "recs" }, open.length ? open.map(dilemmaCard) : h("p", { class: "note" }, "אין דילמות פתוחות.")),
      h("button", { class: "add", onclick: () => { S.dilemmas.push(PM.newDilemma()); touch(); redraw(); } }, "+ דילמה"),
      decided.length ? decidedBox(decided) : null);
  }
  function decidedBox(decided) {
    const box = h("details", { class: "box decided" }, h("summary", {}, "הוכרעו (" + decided.length + ")"),
      h("div", { class: "recs" }, decided.map(dilemmaCard)));
    box.open = decidedOpen;
    box.addEventListener("toggle", () => { decidedOpen = box.open; });
    return box;
  }

  /* ---------- notes tab ---------- */
  function domainPicker(title, withGeneral, onPick) {
    const live = ALL().filter((d) => !(S.removed || []).includes(d.id));
    const opts = [...live.map((d) => [d.id, d.name]), ...(withGeneral ? [[null, GENERAL]] : [])];
    const box = modal(title, h("div", { class: "rlist" }, opts.map(([id, n]) =>
      h("button", { class: "rpick", onclick: () => { box.remove(); onPick(id); } }, n))));
  }

  function noteRow(n) {
    const PM = globalThis.PlanModel;
    const sort = (target) => { PM.sortNote(S, n.id, target); touch(); redraw(); noteBadge(); };
    const t = h("textarea", { rows: 2 }); t.value = n.text || "";
    t.addEventListener("input", () => { n.text = t.value; touch(); });
    const at = n.at ? new Date(n.at).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    return h("div", { class: "pnote" }, t,
      h("div", { class: "row" }, h("span", { class: "when" }, at),
        h("button", { class: "tool", onclick: () => domainPicker("להמלצה – באיזה תחום?", true, (id) => sort({ kind: "rec", domainId: id })) }, "להמלצה"),
        h("button", { class: "tool", onclick: () => sort({ kind: "dilemma" }) }, "לדילמה"),
        h("button", { class: "tool", onclick: () => domainPicker("ל'מה ידוע' – באיזה תחום?", false, (id) => sort({ kind: "known", domainId: id })) }, "ל'מה ידוע'"),
        h("button", { class: "tool", onclick: () => ask("למחוק את הפתק?", "כן, למחוק", () => sort({ kind: "delete" })) }, "מחק")));
  }

  function viewNotes() {
    const PM = globalThis.PlanModel;
    PM.migrate(S);
    const list = PM.notesNewest(S);
    return h("section", {},
      h("h1", {}, "פתקים"),
      h("p", { class: "note jtop" }, "מה שנרשם תוך כדי. ממיינים כל פתק למקום שלו. ", h("b", { class: "nhint" }, "הלקוח יראה את הפתקים.")),
      list.length ? h("div", { class: "pnotes" }, list.map(noteRow)) : h("p", { class: "note" }, "אין פתקים פתוחים."));
  }

  // Count of notes on the "פתקים" tab.
  function noteBadge() {
    const tab = document.querySelector('.tab[data-view="notes"]');
    if (!tab) return;
    let b = tab.querySelector(".nbadge");
    const n = ((typeof S !== "undefined" && S && S.notes) || []).length;
    if (!b) { b = h("span", { class: "nbadge" }); tab.append(b); }
    b.textContent = n ? String(n) : "";
    b.hidden = !n;
  }

  // Floating "+ פתק" (every tab): one-line input → new note.
  function noteButton() {
    noteBadge();
    if (document.getElementById("noteFab")) return;
    const fab = h("button", { id: "noteFab", class: "notefab", title: "פתק מהיר", onclick: () => {
      if (document.getElementById("noteBar")) return;
      const i = h("input", { placeholder: "מה לרשום? (Enter לשמירה, Esc לביטול)" });
      const close = () => bar.remove();
      const go = () => {
        const v = i.value.trim();
        if (v) { globalThis.PlanModel.migrate(S); S.notes.push(globalThis.PlanModel.newNote(v)); touch(); noteBadge(); if (S.view === "notes") redraw(); }
        close();
      };
      i.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); else if (e.key === "Escape") close(); });
      const bar = h("div", { id: "noteBar", class: "notebar" }, i, h("small", { class: "nhint" }, "הלקוח יראה את הפתקים"),
        h("button", { class: "tool on", onclick: go }, "שמירה"), h("button", { class: "tool", onclick: close }, "ביטול"));
      document.body.append(bar);
      i.focus();
    } }, "+ פתק");
    document.body.append(fab);
  }

  // Admin lists arrive after the map opened: refresh the plan once, unless the user is typing.
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("tachles:lists", () => {
    try {
      if (typeof S === "undefined" || S.view !== "summary") return;
      const f = document.activeElement;
      if (f && f.closest && f.closest("#app") && /INPUT|TEXTAREA|SELECT/.test(f.tagName)) return;
      redraw();
    } catch (_) {}
  });

  globalThis.viewJourney = viewJourney;
  globalThis.viewPlan = viewPlan;
  globalThis.viewDilemmas = viewDilemmas;
  globalThis.viewNotes = viewNotes;
  globalThis.noteButton = noteButton;
  globalThis.PlanUI = { stepRef, stepQs, viewJourney, viewPlan, viewDilemmas, viewNotes, noteButton, stepOptions, recCategory, ideaGroups, ruleRec, RULE_DOMAIN };
})();
