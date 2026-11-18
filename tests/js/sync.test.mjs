import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createSync } from "../../app/js/sync.js";

function mem() { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, _m: m }; }
afterEach(() => mock.timers.reset());
const tick = () => new Promise(r => setImmediate(r));

function setup(remoteSave) {
  mock.timers.enable({ apis: ["setTimeout"] });
  const storage = mem(), statuses = [];
  const s = createSync({ remoteSave, localKey: "k", storage, onStatus: x => statuses.push(x) });
  return { s, storage, statuses };
}

test("writes local immediately", () => {
  const { s, storage } = setup(async () => 1);
  s.change({ a: 1 });
  assert.deepEqual(JSON.parse(storage.getItem("k")).state, { a: 1 });
});

test("debounces", async () => {
  const calls = [];
  const { s } = setup(async (st) => { calls.push(st); return 1; });
  s.change({ n: 1 }); mock.timers.tick(300);
  s.change({ n: 2 }); mock.timers.tick(300);
  s.change({ n: 3 }); mock.timers.tick(800);
  await tick();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { n: 3 });
});

test("retries after failure", async () => {
  let n = 0;
  const { s, statuses } = setup(async () => { n++; if (n === 1) throw new Error("net"); return 1; });
  s.change({}); mock.timers.tick(800); await tick(); await tick();
  assert.equal(statuses.at(-1), "offline");
  mock.timers.tick(5000); await tick(); await tick();
  assert.equal(n, 2);
  assert.equal(statuses.at(-1), "saved");
});

test("conflict keeps local copy", async () => {
  let n = 0;
  const { s, storage, statuses } = setup(async () => { n++; throw { code: "conflict" }; });
  s.change({ keep: 1 }); mock.timers.tick(800); await tick(); await tick();
  assert.equal(statuses.at(-1), "conflict");
  mock.timers.tick(20000); await tick();
  assert.equal(n, 1);
  assert.deepEqual(JSON.parse(storage.getItem("k")).state, { keep: 1 });
});

test("auth error surfaces", async () => {
  let n = 0;
  const { s, statuses } = setup(async () => { n++; throw { code: "auth" }; });
  s.change({}); mock.timers.tick(800); await tick(); await tick();
  assert.equal(statuses.at(-1), "auth");
  mock.timers.tick(20000); await tick();
  assert.equal(n, 1);
});

test("version advances", async () => {
  const versions = [];
  const { s } = setup(async (st, v) => { versions.push(v); return v + 7; });
  s.setVersion(0);
  s.change({}); mock.timers.tick(800); await tick(); await tick();
  s.change({}); mock.timers.tick(800); await tick(); await tick();
  assert.deepEqual(versions, [0, 7]);
});

test("flush saves pending change now", async () => {
  const calls = [];
  const { s } = setup(async (st) => { calls.push(st); return 1; });
  s.change({ f: 1 });
  await s.flush();
  assert.equal(calls.length, 1);
});

test("local copy records the version it is based on", async () => {
  const { s, storage } = setup(async (st, v) => v + 1);
  s.setVersion(4);
  s.change({ a: 1 });
  assert.deepEqual(JSON.parse(storage.getItem("k")), { v: 4, state: { a: 1 } });
  mock.timers.tick(800); await tick(); await tick();
  assert.deepEqual(JSON.parse(storage.getItem("k")), { v: 5, state: { a: 1 } });
});

test("forbidden stops without retry", async () => {
  let n = 0;
  const { s, statuses } = setup(async () => { n++; throw { code: "forbidden" }; });
  s.change({}); mock.timers.tick(800); await tick(); await tick();
  assert.equal(statuses.at(-1), "forbidden");
  mock.timers.tick(20000); await tick();
  assert.equal(n, 1);
});
