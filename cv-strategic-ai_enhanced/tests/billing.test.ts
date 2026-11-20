import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAN_CATALOG,PLAN_QUOTAS,PLAN_DISPLAY_NAMES,discountedAmount } from "../src/lib/billing/catalog";
test("Pro monthly prices match approved fixed currencies",()=>{assert.equal(PLAN_CATALOG.pro.monthly.USD.amountMinor,1800);assert.equal(PLAN_CATALOG.pro.monthly.EUR.amountMinor,1700);assert.equal(PLAN_CATALOG.pro.monthly.TND.amountMinor,60000);});
test("Consultant annual prices match approved fixed currencies",()=>{assert.equal(PLAN_CATALOG.consultant.annual.USD.amountMinor,44900);assert.equal(PLAN_CATALOG.consultant.annual.EUR.amountMinor,42700);assert.equal(PLAN_CATALOG.consultant.annual.TND.amountMinor,1493000);});
test("Annual Pro quotas are allocated upfront",()=>{assert.deepEqual(PLAN_QUOTAS.pro.annual,{analyses:300,generations:250});});
test("Consultant annual quotas are finite",()=>{assert.deepEqual(PLAN_QUOTAS.consultant.annual,{analyses:1300,generations:1300});});
test("Approved discount is applied using integer minor units",()=>{assert.equal(discountedAmount(1800,40),1080);assert.equal(discountedAmount(60000,40),36000);});
test("Invalid discount percentage is rejected",()=>assert.throws(()=>discountedAmount(1800,140)));

test("Candidate offer display names distinguish Gold from Consulting mode",()=>{assert.equal(PLAN_DISPLAY_NAMES.pro,"Pro");assert.equal(PLAN_DISPLAY_NAMES.consultant,"Gold");});
