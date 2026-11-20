import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyPaddleSignature } from "../src/lib/billing/providers/paddle";

const secret = "pdl_ntfset_test_secret";
const raw = JSON.stringify({ event_id: "evt_0123456789abcdefghjklmnopq", event_type: "transaction.paid" });
function signature(body: string, timestamp: number) {
  const digest = createHmac("sha256", secret).update(`${timestamp}:${body}`, "utf8").digest("hex");
  return `ts=${timestamp};h1=${digest}`;
}
test("accepts a valid Paddle signature for the exact raw body", () => {
  const now = 1_800_000_000;
  assert.equal(verifyPaddleSignature(raw, signature(raw, now), secret, now), true);
});
test("rejects a modified payload", () => {
  const now = 1_800_000_000;
  assert.equal(verifyPaddleSignature(raw + " ", signature(raw, now), secret, now), false);
});
test("rejects stale signatures", () => {
  const now = 1_800_000_000;
  assert.equal(verifyPaddleSignature(raw, signature(raw, now - 301), secret, now), false);
});
test("rejects malformed and missing signatures", () => {
  assert.equal(verifyPaddleSignature(raw, "", secret), false);
  assert.equal(verifyPaddleSignature(raw, "ts=abc;h1=bad", secret), false);
});
