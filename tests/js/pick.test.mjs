import { test } from "node:test";
import assert from "node:assert/strict";
import { pickStart } from "../../app/js/sync.js";

const cloud = (version, state) => ({ version, state });

test("no local copy → cloud", () => {
  assert.deepEqual(pickStart(cloud(3, { x: 1 }), null), { state: { x: 1 }, push: false, backup: null });
});
test("local edits on top of the same cloud version → local, pushed", () => {
  const local = { v: 3, state: { x: 2 } };
  assert.deepEqual(pickStart(cloud(3, { x: 1 }), local), { state: { x: 2 }, push: true, backup: null });
});
test("cloud moved on (other tab / import) → cloud wins, local kept as backup", () => {
  const local = { v: 2, state: { x: 9 } };
  assert.deepEqual(pickStart(cloud(3, { x: 1 }), local), { state: { x: 1 }, push: false, backup: { x: 9 } });
});
test("local identical to cloud → no push, no backup", () => {
  const local = { v: 3, state: { x: 1 } };
  assert.deepEqual(pickStart(cloud(3, { x: 1 }), local), { state: { x: 1 }, push: false, backup: null });
});
test("offline: no cloud row → local", () => {
  assert.deepEqual(pickStart(null, { v: 3, state: { x: 2 } }), { state: { x: 2 }, push: true, backup: null });
});
test("old-format local copy (bare state) is treated as backup", () => {
  assert.deepEqual(pickStart(cloud(3, { x: 1 }), { version: 1, domains: {} }), { state: { x: 1 }, push: false, backup: { version: 1, domains: {} } });
});
