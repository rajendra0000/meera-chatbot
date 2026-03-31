import assert from "node:assert/strict";
import test from "node:test";
import { fallbackRouter } from "./router.service.js";

test("fallbackRouter treats filler acknowledgements as VAGUE", () => {
  const result = fallbackRouter("okay", "ROOM_TYPE");

  assert.equal(result.type, "VAGUE");
  assert.equal(result.extractedValue, null);
  assert.equal(result.isVague, true);
});

test("fallbackRouter still treats concrete answers as STEP_ANSWER", () => {
  const result = fallbackRouter("bedroom", "ROOM_TYPE");

  assert.equal(result.type, "STEP_ANSWER");
  assert.equal(result.extractedValue, "bedroom");
  assert.equal(result.isVague, false);
});
