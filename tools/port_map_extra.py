"""Second batch of map changes (Avraham, 17.11): vision question editing/adding, goal types in the plan."""

VISION_OLD = '''  const qs=VISION_QS.map((q,i)=>{ const t=h("textarea",{rows:2,placeholder:"תשובה"}); t.value=V.answers[i]||""; t.addEventListener("input",()=>{V.answers[i]=t.value;touch()}); return h("div",{class:"q"},h("label",{},q),t) });'''
VISION_NEW = '''  V.extraQs=V.extraQs||[]; V.qEdits=V.qEdits||{};
  const vq=[...VISION_QS.map((q,i)=>({k:i,q})), ...V.extraQs.map((q,i)=>({k:"x"+i,q,extra:true}))];
  const qs=[...vq.map(o=>{ const t=h("textarea",{rows:2,placeholder:"תשובה"}); t.value=V.answers[o.k]||""; t.addEventListener("input",()=>{V.answers[o.k]=t.value;touch()});
    const lab=h("label",{}, V.qEdits[o.k]||o.q);
    lab.addEventListener("input",()=>{ V.qEdits[o.k]=lab.textContent.trim()||o.q; touch() }); lab.addEventListener("blur",()=>{ lab.contentEditable="false" });
    const ed=h("button",{class:"qedit",title:"לדייק את נוסח השאלה",onclick:()=>{ lab.contentEditable="true"; lab.focus() }},"✎ דיוק");
    return h("div",{class:"q"}, h("div",{}, lab, o.extra?h("span",{class:"tag"},"נוספה"):null, ed), t) }), addQ(V)];'''

RECAP_OLD = '''  VISION_QS.forEach((q,i)=>{ const a=(V.answers[i]||"").trim(); if(a) vis.push(`${q} → ${a}`) });'''
RECAP_NEW = '''  [...VISION_QS.map((q,i)=>[i,q]), ...(V.extraQs||[]).map((q,i)=>["x"+i,q])].forEach(([k,q])=>{ const a=(V.answers[k]||"").trim(); if(a) vis.push(`${(V.qEdits&&V.qEdits[k])||q} → ${a}`) });'''

PLAN_OLD = '''h("div",{class:"q"},h("label",{},"יעד במספר"),ta(a,"target","מה מודדים",2))),'''
PLAN_NEW = '''goalBox(a)),'''

HELPERS_ANCHOR = "function pairs(list, ph1, ph2){"
HELPERS = '''const KINDS={count:"נספר",steps:"שלבים",feel:"תחושה"};
function goalBox(a){
  a.kind=a.kind||"count";
  const sel=h("div",{class:"kinds"}, Object.entries(KINDS).map(([k,n])=>h("button",{class:a.kind===k?"on":"",onclick:()=>{a.kind=k;touch();render()}},n)));
  const f = a.kind==="count" ? [h("label",{},"היום"),inp(a,"start","למשל 4"),h("label",{},"יעד"),inp(a,"target","למשל 10"),h("label",{},"מה סופרים"),inp(a,"unit","למשל פניות בחודש")]
          : a.kind==="feel" ? [h("label",{},"השאלה"),inp(a,"unit","למשל: כמה אתה מרגיש על ההגה?"),h("label",{},"דירוג היום (1–10)"),inp(a,"start","","number")]
          : [h("p",{class:"note"},"נמדד לפי אבני הדרך, ואם אין – לפי המשימות שבוצעו")];
  return h("div",{class:"q"}, h("label",{},"איך מודדים"), sel, h("div",{class:"kfields"}, f));
}
function goalLine(a){ const k=a.kind||"count";
  if(k==="count") return [a.start&&"היום: "+a.start, a.target&&"יעד: "+a.target, a.unit&&"("+a.unit+")"].filter(Boolean).join(" · ");
  if(k==="feel") return "תחושה"+(a.unit?" – "+a.unit:"")+(a.start?" · היום "+a.start+"/10":"");
  return "לפי אבני הדרך, ואם אין – לפי המשימות שבוצעו"; }
'''
CSS = (".kinds{display:flex;gap:6px;margin:4px 0 8px}.kinds button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px 12px;font:inherit;font-size:14px;cursor:pointer}"
       ".kinds button.on{background:var(--charcoal);color:var(--ivory);border-color:var(--charcoal)}"
       ".kfields{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center}\n")


def apply(s, rep):
    # recap: the full raw picture is folded; the client sees only what was agreed (Avraham, 17.11)
    s = rep(s, '    secs.length? secs : h("p",{class:"note"},"עדיין לא נכתב כלום בפגישה הזו."),',
            '    secs.length? h("details",{class:"raw"}, h("summary",{},"התמונה המלאה מהפגישה (בשבילך – לפתוח בלחיצה)"), secs) : h("p",{class:"note"},"עדיין לא נכתב כלום בפגישה הזו."),')
    s = rep(s, '"נבנה אוטומטית מכל מה שנכתב בפגישה. עוברים עליו יחד בסוף, ומשלימים מה סיכמנו ומה עושים עד הפגישה הבאה. ההערות הפרטיות שלך לא נכנסות לכאן."',
            '"בסוף הפגישה ממלאים יחד את מה שסיכמנו. התמונה המלאה מקופלת – היא נשארת בשבילך ובשבילי, ולא מוצגת ללקוח."')
    s = rep(s, "</style>", ".raw{margin:12px 0 18px}.raw>summary{cursor:pointer;color:var(--bronze);font-weight:700;padding:8px 0}.raw[open]>summary{margin-bottom:10px}\n</style>")
    # no limit on active domains – chosen per client (Avraham, 17.11)
    s = rep(s, '      else if(Sm.active.length<3) Sm.active.push(', '      else Sm.active.push(')
    s = rep(s, '      else { msg("עד 3 תחומים"); return }\n', '')
    s = rep(s, '"תחומים פעילים – עד 3"', '"תחומים פעילים"')
    s = rep(s, VISION_OLD, VISION_NEW)
    s = rep(s, RECAP_OLD, RECAP_NEW)
    s = rep(s, PLAN_OLD, PLAN_NEW)
    s = rep(s, 'a.target&&"יעד: "+a.target,', 'goalLine(a)&&"מדידה: "+goalLine(a),')
    s = rep(s, HELPERS_ANCHOR, HELPERS + HELPERS_ANCHOR)
    s = rep(s, "{name:d.name, goal:a.goal, target:a.target,", '{name:d.name, goal:a.goal, target:a.target, kind:a.kind||"count", start:a.start||"", unit:a.unit||"",')
    s = rep(s, "</style>", CSS + "</style>")
    s = apply_journey(s, rep)
    s = apply_plan(s, rep)
    s = apply_notes(s, rep)
    s = apply_recap(s, rep)
    return s


# ---- Task 4: customer journey tab (plan structure v2) ----
JOURNEY_CSS = (".jtop{margin:-4px 0 16px}"
               ".jgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;align-items:start}"
               ".jcard h3{font-size:18px;margin-bottom:10px}"
               ".jstep{border-top:1px solid var(--line);padding:10px 0}"
               ".jhead{display:flex;align-items:center;gap:8px;margin-bottom:6px}.jhead b{flex:1;font-size:15px;padding:2px 4px;border-radius:4px}"
               ".jchip{border:0;border-radius:999px;color:#fff;padding:3px 12px;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}"
               ".jstep input{font-size:14px;padding:6px 8px}.jqs{margin-top:8px}.jqs .q label{font-size:14px}.jqs textarea{font-size:14px}"
               "@media (max-width:1200px){.jgrid{grid-template-columns:1fr 1fr}}@media (max-width:700px){.jgrid{grid-template-columns:1fr}}\n")


def apply_journey(s, rep):
    s = rep(s, '    <button class="tab" data-view="map">מפת העסק</button>\n',
            '    <button class="tab" data-view="map">מפת העסק</button>\n    <button class="tab" data-view="journey">מסע הלקוח</button>\n')
    # plan model + plan UI load as classic scripts before the loader module (which starts the map script)
    s = rep(s, "</body>\n</html>",
            '<script src="./js/plan-model.js?v=__V__"></script><script src="./js/plan-ui.js?v=__V__"></script>\n</body>\n</html>')
    s = rep(s, "if(!S || S.version!==1) S = fresh();", "if(!S || S.version!==1) S = fresh();\nPlanModel.migrate(S);")
    s = rep(s, "delete d.plan; S=d; S.version=1;", "delete d.plan; S=d; S.version=1; PlanModel.migrate(S);")
    s = rep(s, '  else if(S.view==="recap") app.append(viewRecap());\n',
            '  else if(S.view==="recap") app.append(viewRecap());\n  else if(S.view==="journey") app.append(viewJourney());\n')
    # domain view: no empty strip (marketing/sales moved to the journey); money/team/owner strips are "בדיקות"
    s = rep(s, 'const flow = h("div",{class:"flow"}, d.stages.map(', 'const flow = !d.stages.length ? null : h("div",{class:"flow"}, d.stages.map(')
    s = rep(s, '    h("h3",{style:"margin-bottom:8px"},"התהליך"),\n',
            '    flow? h("h3",{style:"margin-bottom:8px"}, ["money","team","owner"].includes(id)?"בדיקות":"התהליך") : null,\n')
    # migrate removed summary.frozen/blockers/resources – old plan view/recap/export must not crash (Task 5 replaces them)
    s = rep(s, 'pairs(Sm.blockers,"חסם","המלצה")', 'Sm.blockers? pairs(Sm.blockers,"חסם","המלצה") : h("p",{class:"note"},"עבר להערות")')
    s = rep(s, 'pairs(Sm.resources,"משאב","איך מנצלים")', 'Sm.resources? pairs(Sm.resources,"משאב","איך מנצלים") : h("p",{class:"note"},"עבר להערות")')
    s = rep(s, "    Sm.frozen.forEach((f,i)=>fr.append(", "    (Sm.frozen||[]).forEach((f,i)=>fr.append(")
    s = rep(s, '    fr.append(h("button",{class:"add",onclick:()=>{Sm.frozen.push(', '    if(Sm.frozen) fr.append(h("button",{class:"add",onclick:()=>{Sm.frozen.push(')
    s = rep(s, "...Sm.frozen.filter(f=>f.item)", "...(Sm.frozen||[]).filter(f=>f.item)")
    s = rep(s, "const bl=Sm.blockers.filter(", "const bl=(Sm.blockers||[]).filter(")
    s = rep(s, "const rs=Sm.resources.filter(", "const rs=(Sm.resources||[]).filter(")
    s = rep(s, "blockers:S.summary.blockers, resources:S.summary.resources,", "blockers:S.summary.blockers||[], resources:S.summary.resources||[],")
    s = rep(s, "...S.summary.frozen],", "...(S.summary.frozen||[])],")
    # a stage list shorter than the domain's stages must not crash (fills the missing slot)
    s = rep(s, "    const st=D.stages[i];\n", "    D.stages=D.stages||[]; const st=D.stages[i]||(D.stages[i]={state:\"unknown\",note:\"\"});\n")
    s = rep(s, "const by=s=>d.stages.filter((_,i)=>D.stages[i].state===s);", "const by=s=>d.stages.filter((_,i)=>((D.stages||[])[i]||{}).state===s);")
    s = rep(s, "d.stages.forEach((s,i)=>{ if(D.stages[i].note&&D.stages[i].note.trim())", "d.stages.forEach((s,i)=>{ const x=(D.stages||[])[i]; if(x&&x.note&&x.note.trim())")
    s = rep(s, "lines.push(`${s}: ${D.stages[i].note.trim()}`)", "lines.push(`${s}: ${x.note.trim()}`)")
    s = rep(s, "</style>", JOURNEY_CSS + "</style>")
    return s


# ---- Task 5: plan tab – recommendations, tasks, ideas bank (viewPlan lives in app/js/plan-ui.js) ----
PLAN_CSS = (".phead{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:20px}"
            ".prog{font-weight:700;color:var(--bronze);margin:4px 0}"
            ".msbox{margin:8px 0}.msbox>summary{cursor:pointer;color:var(--bronze);font-weight:700;padding:4px 0}"
            ".msbox .ms{grid-template-columns:80px 1fr 150px auto auto}"
            ".recs{display:grid;gap:12px;margin:12px 0}"
            ".rec{border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--paper)}"
            ".rhead{display:flex;gap:8px;align-items:center}.rhead input{font-weight:700}.rhead .kinds{margin:0;flex:none}"
            ".rwhy,.rmeta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px;font-size:14px}"
            ".rwhy>input:not(.sm){flex:1 1 220px}.rwhy .sm{flex:0 1 150px}.rwhy input,.rmeta input,.rmeta select{font-size:14px;padding:6px 8px}"
            ".rmeta select{width:auto;max-width:260px}.rmeta input{flex:1 1 200px}"
            ".rtag{display:inline-flex;align-items:center;gap:4px;background:var(--ivory);border:1px solid var(--gold-l);border-radius:999px;padding:2px 10px;font-size:13px}"
            ".tasks{display:grid;gap:6px;margin:10px 0 6px}"
            ".task{display:grid;grid-template-columns:2fr 1.5fr 1.6fr auto auto auto auto;gap:6px;align-items:center;font-size:14px}"
            ".task input,.task select{font-size:14px;padding:6px 8px}.task .pro{display:grid;gap:4px}"
            ".task .due{display:flex;gap:4px;align-items:center;white-space:nowrap}.task.st-done>input{text-decoration:line-through;color:var(--muted)}"
            "select{font-family:inherit;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--charcoal)}"
            ".ideas>summary{cursor:pointer}.ideas>summary h3{display:inline}"
            ".igrp{margin-top:12px}.igrp h4{margin:0 0 6px;color:var(--bronze)}"
            ".idea{display:grid;grid-template-columns:2fr 2fr 1.5fr auto auto;gap:6px;align-items:center;margin-bottom:6px;font-size:14px}.idea input{font-size:14px;padding:6px 8px}.idea .rtag{grid-column:1/-1;justify-self:start}"
            ".iadd{display:flex;gap:10px;margin-top:12px}"
            ".pmodal{position:fixed;inset:0;background:rgba(22,22,21,.35);display:grid;place-items:center;z-index:50}"
            ".pmodal>div{background:var(--paper);border-radius:14px;padding:22px;width:min(560px,92vw);max-height:80vh;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.2)}"
            ".pmodal .row{display:flex;justify-content:flex-end;margin-top:14px}.pmodal .q{margin-bottom:10px}.pmodal select{width:100%;padding:8px}"
            ".rgrp h4{margin:12px 0 6px;color:var(--bronze)}.rpick{display:block;width:100%;text-align:start;background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin-bottom:4px;font:inherit;font-size:14px;cursor:pointer}.rpick:hover{border-color:var(--gold)}"
            "@media (max-width:900px){.phead{grid-template-columns:1fr}.task,.idea{grid-template-columns:1fr 1fr}}\n")


def apply_plan(s, rep):
    s = rep(s, "  else app.append(viewSummary());\n", "  else app.append(viewPlan());\n")
    s = rep(s, "</style>", PLAN_CSS + "</style>")
    return s


# ---- Task 6: dilemmas tab, notes tab, floating "+ פתק" (views live in app/js/plan-ui.js) ----
NOTES_CSS = (".dil .q{margin-top:8px}.dil.done .rhead input{color:var(--muted)}"
             ".decided{margin-top:20px}.decided>summary{cursor:pointer;color:var(--bronze);font-weight:700}"
             ".pnotes{display:grid;gap:10px;max-width:820px}"
             ".pnote{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--paper)}"
             ".pnote textarea{font-size:15px}.pnote .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}"
             ".pnote .when{color:var(--muted);font-size:13px;margin-inline-end:auto}"
             ".nbadge{display:inline-block;min-width:20px;margin-inline-start:6px;padding:0 6px;border-radius:999px;background:var(--bronze);color:#fff;font-size:12px;line-height:20px;text-align:center;font-weight:700}"
             ".notefab{position:fixed;bottom:20px;inset-inline-start:20px;z-index:40;border:0;border-radius:999px;background:var(--charcoal);color:var(--ivory);padding:10px 18px;font:inherit;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.2);cursor:pointer}"
             ".notefab:hover{background:var(--bronze)}"
             "#app{padding-bottom:80px}"  # the floating "+ פתק" must not cover the last controls
             ".notebar{position:fixed;bottom:72px;inset-inline-start:20px;z-index:45;display:flex;gap:6px;align-items:center;background:var(--paper);border:1px solid var(--gold);border-radius:12px;padding:8px;width:min(520px,calc(100vw - 40px));box-shadow:0 8px 24px rgba(0,0,0,.18)}"
             ".notebar input{flex:1;font-size:15px;padding:8px 10px}.notebar .nhint{color:var(--muted);font-size:12px;white-space:nowrap}.jtop .nhint{color:var(--bronze)}"
             # the map's ".confirm div" rule also boxed the inner button row
             ".confirm .row{background:none;padding:0;box-shadow:none;border-radius:0;max-width:none}\n")


def apply_notes(s, rep):
    s = rep(s, '    <button class="tab" data-view="recap">סיכום הפגישה</button>\n',
            '    <button class="tab" data-view="dilemmas">דילמות</button>\n    <button class="tab" data-view="notes">פתקים</button>\n'
            '    <button class="tab" data-view="recap">סיכום הפגישה</button>\n')
    s = rep(s, '  else if(S.view==="journey") app.append(viewJourney());\n',
            '  else if(S.view==="journey") app.append(viewJourney());\n'
            '  else if(S.view==="dilemmas") app.append(viewDilemmas());\n  else if(S.view==="notes") app.append(viewNotes());\n')
    s = rep(s, "  else app.append(viewPlan());\n", '  else app.append(viewPlan());\n  if(typeof noteButton==="function") noteButton();\n')
    s = rep(s, "</style>", NOTES_CSS + "</style>")
    return s



# ---- Task 7: recap sections and the client-safe plan export (logic lives in PlanModel) ----
DN = "id=>(ALL().find(x=>x.id===id)||{}).name||id"
RECAP_LISTS_OLD = """  const bl=(Sm.blockers||[]).filter(b=>b.text).map(b=>`${b.text}${b.rec?" – "+b.rec:""}`);
  if(bl.length) out.push({title:"חסמים והמלצות", items:bl});
  const rs=(Sm.resources||[]).filter(b=>b.text).map(b=>`${b.text}${b.rec?" – "+b.rec:""}`);
  if(rs.length) out.push({title:"משאבים ואיך מנצלים", items:rs});
"""
EXPORT_OLD = """function exportData(){
  const live=ALL().filter(d=>!S.removed.includes(d.id));
  const notActive=live.filter(d=>!S.summary.active.some(a=>a.domainId===d.id)).map(d=>d.name);
  return {...S, savedAt:new Date().toISOString(), recapText:(S.recapTextSaved=Object.assign(S.recapTextSaved||{}, {[S.meeting]:recapText()})),
    plan:{vision:S.vision.vision, bigGoal:S.vision.bigGoal, goal90:S.vision.goal90,
      blockers:S.summary.blockers||[], resources:S.summary.resources||[],
      frozen:[...notActive.map(n=>({item:n,reason:"לא נבחר כתחום פעיל ב־90 הימים",condition:""})), ...(S.summary.frozen||[])],
      domains:S.summary.active.map(a=>{const d=ALL().find(x=>x.id===a.domainId), D=S.domains[a.domainId];
        return {name:d.name, goal:a.goal, target:a.target, kind:a.kind||"count", start:a.start||"", unit:a.unit||"", blockers:freeText(D,"blockers").blockersText||"", resources:freeText(D,"resources").resourcesText||"", milestones:a.milestones.map(m=>({...m,tasks:[]}))}})}};
}"""
EXPORT_NEW = """function exportData(){
  return {...S, savedAt:new Date().toISOString(), recapText:(S.recapTextSaved=Object.assign(S.recapTextSaved||{}, {[S.meeting]:recapText()})),
    plan:PlanModel.exportPlan(PlanModel.migrate(S), """ + DN + """)};
}"""


def apply_recap(s, rep):
    # journey "where it falls" restores marketing/sales works/weak/missing, right after the domain picture
    s = rep(s, '    out.push({title:"התמונה שעלתה – תחום אחר תחום", groups:items});\n  }\n',
            '    out.push({title:"התמונה שעלתה – תחום אחר תחום", groups:items});\n  }\n'
            '  const jr=PlanModel.recapJourney(PlanModel.migrate(S)); if(jr) out.push(jr);\n')
    # milestones are optional
    s = rep(s, "...a.milestones.filter(m=>m.title).map(", "...(a.milestones||[]).filter(m=>m&&m.title).map(")
    # old frozen list is gone (ideas bank now); old blockers/resources lists are gone (notes / inside recs)
    s = rep(s, '    const frl=[...(fr.length?["לא בטיפול עכשיו: "+nm(fr)]:[]), ...(Sm.frozen||[]).filter(f=>f.item).map(f=>`${f.item}${f.reason?" – "+f.reason:""}${f.condition?" (חוזרים כש"+f.condition+")":""}`)];\n',
            '    const frl=fr.length?["לא בטיפול עכשיו: "+nm(fr)]:[];\n')
    s = rep(s, RECAP_LISTS_OLD, "  out.push(...PlanModel.recapPlan(S, " + DN + "));\n")
    # plan export: journey, recs, dilemmas, notes; no blockers/resources/frozen (whitelisted in PlanModel.exportPlan)
    s = rep(s, EXPORT_OLD, EXPORT_NEW)
    # recap migrates once at the top, so every section reads the v2 state whatever the order
    s = rep(s, "function recapSections(){\n", "function recapSections(){\n  PlanModel.migrate(S);\n")
    s = rep(s, "const jr=PlanModel.recapJourney(PlanModel.migrate(S));", "const jr=PlanModel.recapJourney(S);")
    # fresh map: marketing/sales/product prefill may still be in the old 5-stage shape - keep it for migrate()
    s = rep(s, '      stages:d.stages.map((_,i)=>({state:(c.stages&&c.stages[i])||"unknown", note:""})),\n',
            '      stages:PlanModel.prefillStages(d.id, d.stages, c.stages),\n')
    # the old plan view is replaced by viewPlan (app/js/plan-ui.js): drop the dead code
    a = s.index("function viewSummary(){")
    b = s.index("\n/* ---------- save / load ---------- */", a)
    s = s[:a] + s[b + 1:]
    return s
