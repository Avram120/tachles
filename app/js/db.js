import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=15";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const STAGES = { m1: "פגישה 1", m2: "פגישה 2", owner_work: "בעבודה אצלי", published: "פורסם", view_only: "צפייה בלבד" };

export function signIn() {
  return sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.href.split("#")[0] } });
}
export async function signOut() { await sb.auth.signOut(); location.reload(); }

function gate(html) {
  document.body.innerHTML = `<main class="gate"><img src="logo.png" alt="תכל'ס" class="gate-logo">${html}</main>`;
}

// Resolves with {email} for the admin; otherwise renders a login / no-access screen and never resolves.
export async function requireAdmin() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    const q = new URLSearchParams(location.search + "&" + location.hash.slice(1));
    const err = q.get("error_description") || q.get("error");
    if (err) history.replaceState(null, "", location.pathname);
    gate(`<h1>מערכת תכל'ס</h1><p>כניסה למנהל המערכת</p>`
      + (err ? `<p class="err">הכניסה לא הצליחה. נסה שוב, ואם זה חוזר – תגיד לClaude.<br><small>${err.replace(/[<>&]/g, "")}</small></p>` : "")
      + `<button class="btn" id="go">כניסה עם Google</button>`);
    document.getElementById("go").onclick = signIn;
    return new Promise(() => {});
  }
  const { data: ok, error, status } = await sb.rpc("is_admin");
  if (error && mapError(error, status).code === "network") return { email: session.user.email, offline: true };
  if (error || !ok) {
    gate(`<h1>אין לחשבון הזה גישה</h1><p>${(session.user.email || "").replace(/[<>&"]/g, "")}</p><button class="btn" id="out">יציאה</button>`);
    document.getElementById("out").onclick = signOut;
    return new Promise(() => {});
  }
  return { email: session.user.email };
}

export async function listBusinesses() {
  const { data, error } = await sb.from("businesses")
    .select("id,name,business,email,phone,stage,track,created_at,diagnoses(updated_at)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(b => ({ ...b, updated_at: b.diagnoses?.updated_at || (Array.isArray(b.diagnoses) ? b.diagnoses[0]?.updated_at : null) }));
}

export async function addClient(name, business, email = "", phone = "") {
  const { data, error, status } = await sb.rpc("create_client", { p_name: name, p_business: business, p_email: email, p_phone: phone });
  if (error) throw mapError(error, status);
  return data;
}

export async function loadDiagnosis(id) {
  const { data, error, status } = await sb.from("diagnoses").select("prefill,state,version").eq("business_id", id).single();
  if (error) throw mapError(error, status);
  return data;
}

export function mapError(error, status) {
  const msg = (error && (error.message || error.msg)) || "";
  if (/conflict/.test(msg)) return { code: "conflict" };
  if (/forbidden/.test(msg)) return { code: "forbidden" };
  if (status === 401 || /JWT|jwt/.test(msg)) return { code: "auth" };
  if (status && status !== 0 && status < 500) return { code: "forbidden", message: msg };
  return { code: "network", message: msg };
}

export async function saveDiagnosis(id, state, version) {
  const { data, error, status } = await sb.rpc("save_diagnosis", { p_business: id, p_state: state, p_version: version });
  if (error) throw mapError(error, status);
  return data;
}

// Admin-only lists (RLS: never readable by clients).
export async function listPros() {
  const { data, error, status } = await sb.from("professionals").select("*").order("created_at");
  if (error) throw mapError(error, status);
  return data;
}
export async function savePro(pro) {
  const { id, ...fields } = pro;
  const q = id ? sb.from("professionals").update(fields).eq("id", id) : sb.from("professionals").insert(fields);
  const { data, error, status } = await q.select().single();
  if (error) throw mapError(error, status);
  return data;
}
export async function deletePro(id) {
  const { error, status } = await sb.from("professionals").delete().eq("id", id);
  if (error) throw mapError(error, status);
}
export async function listRules() {
  const { data, error, status } = await sb.from("rules").select("*").order("id");
  if (error) throw mapError(error, status);
  return data;
}
