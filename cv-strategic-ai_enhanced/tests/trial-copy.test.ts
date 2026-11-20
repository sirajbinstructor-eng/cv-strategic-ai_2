import test from "node:test";
import assert from "node:assert/strict";
import { getTrialOfferCopy } from "../src/lib/entitlements/trial-copy";

test("uses the administrator-configured remaining quota in the welcome message", () => {
  const copy = getTrialOfferCopy({ granted: 10, used: 0, reserved: 0, expired: false });
  assert.equal(copy.title, "Welcome! You have 10 free AI analyses.");
  assert.match(copy.body, /10 free analyses available/);
});

test("calculates remaining trials after completed and reserved analyses", () => {
  const copy = getTrialOfferCopy({ granted: 13, used: 2, reserved: 1, expired: false });
  assert.equal(copy.title, "You have 10 free AI analyses remaining!");
  assert.match(copy.body, /2 of 13 free analyses used/);
  assert.match(copy.body, /1 analysis is currently in progress/);
});

test("uses singular wording when exactly one trial remains", () => {
  const copy = getTrialOfferCopy({ granted: 10, used: 9, reserved: 0, expired: false });
  assert.equal(copy.title, "Just 1 free analysis left!");
  assert.match(copy.body, /9 of 10 free analyses used/);
});

test("shows the configured total when the user exhausts a custom quota", () => {
  const copy = getTrialOfferCopy({ granted: 10, used: 10, reserved: 0, expired: false });
  assert.equal(copy.title, "You've used all 10 free analyses!");
  assert.equal(copy.tone, "locked");
});

test("does not claim trials are exhausted while all remaining slots are processing", () => {
  const copy = getTrialOfferCopy({ granted: 10, used: 9, reserved: 1, expired: false });
  assert.equal(copy.title, "Your remaining free analyses are being processed.");
  assert.match(copy.body, /9 of 10 free analyses have been completed and 1 analysis is currently in progress/);
});

test("handles a zero-trial administrator allocation", () => {
  const copy = getTrialOfferCopy({ granted: 0, used: 0, reserved: 0, expired: false });
  assert.equal(copy.title, "No free analyses have been assigned.");
});

test("expiry takes precedence over remaining trial count", () => {
  const copy = getTrialOfferCopy({ granted: 10, used: 0, reserved: 0, expired: true });
  assert.equal(copy.title, "Your free launch offer has ended.");
});
