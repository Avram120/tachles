"""Port the local diagnosis map template into app/map.html (cloud version).
Usage: python tools/port_map.py   (reads the template from J:, writes app/map.html)"""
import pathlib, sys
SRC = pathlib.Path(r"J:\האחסון שלי\ייעוץ עסקי\כלי אבחון\תבנית - מפת אבחון.html")
OUT = pathlib.Path(__file__).resolve().parents[1] / "app" / "map.html"
VERSION = (pathlib.Path(__file__).resolve().parents[1] / "app" / "VERSION").read_text().strip()  # bump on every release

def rep(s, old, new, count=1):
    n = s.count(old)
    if n != count:
        raise SystemExit(f"expected {count} x {old[:60]!r}, found {n}")
    return s.replace(old, new)

def port(s: str) -> str:
    s = rep(s, '<body class="show-q">\n<header class="top">\n  <img id="logo" alt="תכל\'ס">',
            '<body class="show-q">\n<header class="top">\n  <a href="./" class="tool" id="toList" title="חזרה לרשימת הלקוחות">← לקוחות</a>\n  <img id="logo" alt="תכל\'ס">')
    s = rep(s, '<span class="saved" id="savedMsg"></span>',
            '<span class="saved" id="savedMsg"></span><span class="cloud" id="cloudMsg"></span>')
    s = rep(s, ".saved{font-size:12px;color:var(--muted);min-width:70px}",
            ".saved{font-size:12px;color:var(--muted);min-width:70px}\n"
            ".cloud{font-size:13px;color:var(--muted);white-space:nowrap}.cloud.bad{color:#B5523B;font-weight:700}.cloud button{margin-inline-start:6px}\n"
            ".qedit{background:none;border:0;cursor:pointer;color:var(--muted);font-size:13px;padding:0 4px}.qedit:hover{color:var(--bronze)}\n"
            "label[contenteditable=true]{outline:1px dashed var(--gold);background:#fff;padding:2px 4px;border-radius:6px}\n"
            "#toList{text-decoration:none}")
    # backup file actions move into a "⋯" menu; loading asks first (Avraham, 17.11)
    s = rep(s, '  <button class="tool" id="bSave">שמור</button>\n  <button class="tool" id="bLoad">טען</button>',
            '  <div class="more"><button class="tool" id="bMore" title="עוד">⋯</button>\n'
            '    <div class="menu hidden" id="menu"><button id="bSave">הורד גיבוי למחשב</button><button id="bLoad">טען מגיבוי…</button></div></div>')
    s = rep(s, "#toList{text-decoration:none}",
            "#toList{text-decoration:none}\n"
            ".more{position:relative}.menu{position:absolute;top:110%;inset-inline-end:0;background:var(--paper);border:1px solid var(--line);border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.08);padding:6px;display:grid;min-width:180px;z-index:20}"
            ".menu button{background:none;border:0;text-align:start;padding:8px 10px;border-radius:6px;font:inherit;font-size:14px;cursor:pointer}.menu button:hover{background:var(--ivory)}\n"
            ".confirm{position:fixed;inset:0;background:rgba(22,22,21,.35);display:grid;place-items:center;z-index:50}"
            ".confirm div{background:var(--paper);border-radius:14px;padding:22px;max-width:380px;box-shadow:0 10px 30px rgba(0,0,0,.2)}.confirm p{margin:0 0 16px}"
            ".confirm .row{display:flex;gap:10px;justify-content:flex-end}")
    # free writing for domain blockers/resources (Avraham, 17.11); old rows become text once
    s = rep(s, 'h("div",{style:"margin-top:16px"}, h("h3",{},"חסמים בתחום"), pairs(D.blockers,"חסם","המלצה")),',
            'h("div",{style:"margin-top:16px"}, h("h3",{},"חסמים בתחום"), ta(freeText(D,"blockers"),"blockersText","מה עוצר אותו בתחום הזה? כתיבה חופשית",4)),')
    s = rep(s, 'h("div",{style:"margin-top:12px"}, h("h3",{},"משאבים בתחום"), pairs(D.resources,"משאב","איך מנצלים")),',
            'h("div",{style:"margin-top:12px"}, h("h3",{},"משאבים בתחום"), ta(freeText(D,"resources"),"resourcesText","על מה אפשר להישען? כתיבה חופשית",4)),')
    s = rep(s, "      D.blockers.filter(b=>b.text).forEach(b=>lines.push(`חסם: ${b.text}${b.rec?\" – \"+b.rec:\"\"}`));\n"
               "      D.resources.filter(b=>b.text).forEach(b=>lines.push(`משאב: ${b.text}${b.rec?\" – \"+b.rec:\"\"}`));",
            "      if((freeText(D,\"blockers\").blockersText||\"\").trim()) lines.push(\"חסמים: \"+D.blockersText.trim());\n"
            "      if((freeText(D,\"resources\").resourcesText||\"\").trim()) lines.push(\"משאבים: \"+D.resourcesText.trim());")
    s = rep(s, "blockers:D.blockers, resources:D.resources, milestones:",
            "blockers:freeText(D,\"blockers\").blockersText||\"\", resources:freeText(D,\"resources\").resourcesText||\"\", milestones:")
    s = rep(s, "function pairs(list, ph1, ph2){",
            "function freeText(D,kind){ const k=kind+\"Text\"; if(D[k]===undefined){ D[k]=(D[kind]||[]).filter(b=>b&&b.text).map(b=>b.text+(b.rec?\" – \"+b.rec:\"\")).join(\"\\n\") } return D }\n"
            "function pairs(list, ph1, ph2){")
    import port_map_extra
    s = port_map_extra.apply(s, rep)
    # the map script waits for cloud data: it becomes inert text, started by the loader module below
    s = rep(s, "<script>\nconst LOGO = \"__LOGO__\";\nconst CLIENT = /*CLIENT_DATA*/null/*END*/;",
            "<script type=\"text/x-map\" id=\"mapsrc\">\nconst LOGO = \"logo.png\";\nconst CLIENT = window.__CLIENT;")
    s = rep(s, 'const KEY = "tachles-map:" + (C.client.name||"x");', 'const KEY = "tachles-map:" + window.__BID;')
    s = rep(s, "try{ S = JSON.parse(localStorage.getItem(KEY)) }catch(e){}\nif(!S || S.version!==1) S = fresh();",
            "S = window.__STATE || null;\n"
            "try{ const L = JSON.parse(localStorage.getItem(KEY)); if(L && L.version===1 && (!S || (L.localAt||\"\") > (S.localAt||\"\"))) { S = L; window.__LOCAL_NEWER = true; } }catch(e){}\n"
            "if(!S || S.version!==1) S = fresh();")
    s = rep(s, "  saveT = setTimeout(()=>{ try{localStorage.setItem(KEY, JSON.stringify(S)); msg(\"נשמר בדפדפן\")}catch(e){} }, 400);",
            "  S.localAt = new Date().toISOString(); window.__sync.change(S);")
    # question wording can be edited; answers stay on the original key
    s = rep(s, "const qs=h(\"div\",{}, allQs.map(o=>{ const t=h(\"textarea\",{rows:2,placeholder:\"תשובה\"}); t.value=D.answers[o.k]||\"\"; t.addEventListener(\"input\",()=>{D.answers[o.k]=t.value;touch()});\n"
            "    return h(\"div\",{class:\"q\"}, h(\"label\",{},o.q, o.extra?h(\"span\",{class:\"tag\"},\"ממוקדת\"):null), t) }));",
            "const qs=h(\"div\",{}, allQs.map(o=>{ const t=h(\"textarea\",{rows:2,placeholder:\"תשובה\"}); t.value=D.answers[o.k]||\"\"; t.addEventListener(\"input\",()=>{D.answers[o.k]=t.value;touch()});\n"
            "    const lab=h(\"label\",{}, qText(D,o.k,o.q));\n"
            "    lab.addEventListener(\"input\",()=>{ D.qEdits=D.qEdits||{}; D.qEdits[o.k]=lab.textContent.trim()||o.q; touch() });\n"
            "    lab.addEventListener(\"blur\",()=>{ lab.contentEditable=\"false\" });\n"
            "    const ed=h(\"button\",{class:\"qedit\",title:\"לדייק את נוסח השאלה\",onclick:()=>{ lab.contentEditable=\"true\"; lab.focus() }},\"✎ דיוק\");\n"
            "    return h(\"div\",{class:\"q\"}, h(\"div\",{}, lab, o.extra?h(\"span\",{class:\"tag\"},\"ממוקדת\"):null, ed), t) }));")
    s = rep(s, "keys.forEach((k,i)=>{ const a=(D.answers[k]||\"\").trim(); if(a) lines.push(`${qs[i]} → ${a}`) });",
            "keys.forEach((k,i)=>{ const a=(D.answers[k]||\"\").trim(); if(a) lines.push(`${qText(D,k,qs[i])} → ${a}`) });")
    s = rep(s, "/* ---------- helpers ---------- */",
            "/* ---------- helpers ---------- */\nfunction qText(D,k,orig){ return (D.qEdits&&D.qEdits[k]) || orig }")
    # loader: admin check, load from cloud, then start the map
    loader = r'''
<script type="module">
import { requireAdmin, loadDiagnosis, saveDiagnosis, signIn, listPros, listRules } from "./js/db.js?v=__V__";
import { createSync, pickStart } from "./js/sync.js?v=__V__";
const bid = new URLSearchParams(location.search).get("b");
const app = document.getElementById("app"), cloud = document.getElementById("cloudMsg");
const me = await requireAdmin();
// admin-only lists for the plan (professionals, master rules): once, fail-soft – the map opens without them
window.__PROS = []; window.__RULES = [];
if (!me.offline) {
  const got = () => dispatchEvent(new Event("tachles:lists"));
  listPros().then((d) => { window.__PROS = d || []; got(); }).catch((e) => console.warn("professionals list not loaded", e));
  listRules().then((d) => { window.__RULES = d || []; got(); }).catch((e) => console.warn("rules list not loaded", e));
}
const STATUS = { saving: ["שומר…", 0], saved: ["נשמר בענן ✓", 0], offline: ["לא נשמר בענן – מנסה שוב", 1],
                 conflict: ["המפה עודכנה במקום אחר – רענן", 1], auth: ["צריך להתחבר מחדש", 1], forbidden: ["אין הרשאה לשמור – פנה לClaude", 1] };
const btn = (t, f) => Object.assign(document.createElement("button"), { className: "tool", textContent: t, onclick: f });
function show(s) {
  const [t, bad] = STATUS[s] || [s, 0];
  cloud.className = "cloud" + (bad ? " bad" : ""); cloud.textContent = t;
  if (s === "conflict") cloud.append(btn("רענן", () => location.reload()));
  if (s === "auth") cloud.append(btn("התחברות", () => signIn()));
}
const stop = (html) => { app.innerHTML = `<p style="padding:24px">${html} <a href="./">לרשימת הלקוחות</a></p>`; throw new Error(html); };
if (!bid) stop("לא נבחר לקוח.");
const KEY = "tachles-map:" + bid;
let local = null; try { local = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
let row = null;
if (!me.offline) {
  try { row = await loadDiagnosis(bid); }
  catch (e) { if (e.code !== "network") stop("לא מצאתי את הלקוח הזה."); }
}
if (!row && !local) stop("אין חיבור לאינטרנט, ואין במחשב הזה עותק שמור של המפה.");
const pick = pickStart(row, local);
window.__BID = bid; window.__STATE = pick.state;
window.__CLIENT = row ? row.prefill : (pick.state && pick.state.__prefill) || { client: pick.state?.client || { name: "" }, domains: [], prefill: {} };
window.__sync = createSync({ localKey: KEY, onStatus: show, remoteSave: (state, version) => saveDiagnosis(bid, state, version) });
window.__sync.setVersion(row ? row.version : (local && local.v) || 0);
const s = document.createElement("script"); s.textContent = document.getElementById("mapsrc").textContent; document.body.append(s);
if (pick.backup) {
  const name = "tachles-map-backup:" + bid + ":" + new Date().toISOString();
  try { localStorage.setItem(name, JSON.stringify(pick.backup)); } catch (_) {}
  show("saved");
  cloud.append(btn("יש במחשב הזה עותק שלא נשמר בענן – הורד", () => {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify(pick.backup, null, 2)], { type: "application/json" })), download: "עותק מקומי - " + (S.client?.name || "מפה") + ".json" });
    document.body.append(a); a.click(); a.remove();
  }));
} else if (!row) show("offline");
else show(row.state ? "saved" : "saving");
if (row && !row.state) { S.__prefill = row.prefill; window.__sync.change(S); }
else if (pick.push) window.__sync.change(S);
else if (row) { S.__prefill = row.prefill; try { localStorage.setItem(KEY, JSON.stringify({ v: row.version, state: S })); } catch (_) {} }
// same map open in another tab of this browser → warn both
const ch = new BroadcastChannel(KEY);
ch.onmessage = (e) => { if (e.data === "hello") ch.postMessage("here"); if (e.data === "hello" || e.data === "here") { cloud.className = "cloud bad"; cloud.textContent = "המפה פתוחה גם בלשונית אחרת – עבוד רק באחת"; } };
ch.postMessage("hello");
// "⋯" menu + confirm before loading a backup file (current state kept as a local backup first)
const menu = document.getElementById("menu");
document.getElementById("bMore").onclick = (e) => { e.stopPropagation(); menu.classList.toggle("hidden"); };
document.addEventListener("click", () => menu.classList.add("hidden"));
function ask(text, yes, onYes) {
  const box = document.createElement("div"); box.className = "confirm";
  box.innerHTML = `<div><p></p><div class="row"><button class="tool" data-a="no">ביטול</button><button class="tool on" data-a="yes"></button></div></div>`;
  box.querySelector("p").textContent = text; box.querySelector("[data-a=yes]").textContent = yes;
  box.onclick = (e) => { const a = e.target.dataset.a; if (a) { box.remove(); if (a === "yes") onYes(); } };
  document.body.append(box);
}
document.getElementById("bLoad").onclick = () => ask("טעינה מגיבוי תחליף את כל מה שיש במפה עכשיו. המצב הנוכחי יישמר במחשב לפני ההחלפה. להמשיך?",
  "כן, לבחור קובץ", () => document.getElementById("fLoad").click());
document.getElementById("fLoad").addEventListener("change", () => {
  try { localStorage.setItem("tachles-map-backup:" + bid + ":" + new Date().toISOString(), JSON.stringify(S)); } catch (_) {}
}, true);
addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") window.__sync.flush(); });
addEventListener("beforeunload", (e) => { if (window.__sync.hasPending()) { e.preventDefault(); e.returnValue = ""; } });
</script>
'''
    s = rep(s, "</body>\n</html>", loader + "</body>\n</html>")
    s = s.replace("__V__", VERSION)
    s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">', 1)
    return s

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    OUT.write_text(port(SRC.read_text(encoding="utf-8")), encoding="utf-8")
    print("wrote", OUT)
