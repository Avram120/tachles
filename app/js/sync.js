// Debounced cloud save with an immediate local backup.
// Local copy format: {v: <cloud version it is based on>, state}.
// remoteSave(state, version) -> Promise<newVersion>; rejects {code:"conflict"|"auth"|"forbidden"} or any error (= offline).
export function createSync({ remoteSave, localKey, delayMs = 800, retryMs = 5000,
                             storage = globalThis.localStorage, onStatus = () => {} }) {
  let version = 0, pending = null, timer = null, inFlight = null, blocked = false, paused = false, last = null;

  const writeLocal = (state) => { try { storage.setItem(localKey, JSON.stringify({ v: version, state })); } catch (_) {} };
  const schedule = (ms) => { clearTimeout(timer); timer = setTimeout(run, ms); };

  async function run() {
    timer = null;
    if (blocked || pending === null) return;
    if (inFlight) { await inFlight; return run(); }
    const state = pending; pending = null;
    onStatus("saving");
    inFlight = (async () => {
      try {
        version = await remoteSave(state, version);
        if (pending === null && last === state) writeLocal(state);
        onStatus("saved");
      } catch (e) {
        const code = e && e.code;
        if (code === "conflict" || code === "forbidden") { blocked = true; onStatus(code); return; }
        if (pending === null) pending = state;
        if (code === "auth") { paused = true; onStatus("auth"); return; }
        onStatus("offline");
        schedule(retryMs);
      }
    })();
    await inFlight; inFlight = null;
    if (pending !== null && !timer && !blocked && !paused) schedule(delayMs);
  }

  return {
    change(state) {
      last = state;
      writeLocal(state);
      pending = state; paused = false;
      if (!blocked) schedule(delayMs);
    },
    async flush() { clearTimeout(timer); await run(); },
    setVersion(v) { version = v; },
    hasPending() { return pending !== null || !!inFlight; },
  };
}

// Decide what the map starts from. cloudRow = {version, state} or null (offline); local = stored copy or null.
export function pickStart(cloudRow, local) {
  const wrapped = local && typeof local === "object" && "v" in local && "state" in local;
  if (!cloudRow) return { state: wrapped ? local.state : local, push: !!local, backup: null };
  if (!local) return { state: cloudRow.state, push: false, backup: null };
  if (!wrapped) return { state: cloudRow.state, push: false, backup: local };
  const same = JSON.stringify(local.state) === JSON.stringify(cloudRow.state);
  if (same) return { state: cloudRow.state, push: false, backup: null };
  if (local.v === cloudRow.version) return { state: local.state, push: true, backup: null };
  return { state: cloudRow.state, push: false, backup: local.state };
}
