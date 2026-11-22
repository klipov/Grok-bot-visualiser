import assert from "node:assert/strict";
import { test } from "node:test";
import { demoHandoff } from "../src/lib/office/demo";

test("replaying the same sample creates a new physical handoff", () => {
  const first = demoHandoff(0);
  const replay = demoHandoff(0);
  assert.equal(replay.message, first.message);
  assert.notEqual(replay.id, first.id);
});
