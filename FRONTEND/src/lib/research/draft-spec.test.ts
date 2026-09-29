import assert from "node:assert/strict";
import { draftSpec, mergeCompiledDraft } from "./draft-spec.ts";

const close = draftSpec("Trade NVDA in the last cash hour.");
assert.equal(close.family, "session_timing");
assert.equal(close.session_hour, 15);
assert.deepEqual(close.variants.map((item) => item.code), ["continuation", "reversal"]);

const open = draftSpec("Trade NVDA in the first hour of the cash session.");
assert.equal(open.family, "session_timing");
assert.equal(open.session_hour, undefined);

const basis = draftSpec("Fade the NVDA perp versus spot basis.");
assert.equal(basis.family, "basis_convergence");
assert.deepEqual(basis.instruments, ["NVDAUSDT", "RNVDAUSDT"]);
assert.deepEqual(basis.variants.map((item) => item.code), ["fade"]);

const carry = draftSpec("Hold BTC perp funding against cash.");
assert.equal(carry.family, "carry_basis");
assert.deepEqual(carry.instruments, ["BTCUSDT"]);
assert.deepEqual(carry.baselines, ["earn_usdt", "btc_eth_carry"]);

const weekend = draftSpec("Trade NVDA over the weekend instead of waiting for StockRoute.");
assert.equal(weekend.family, "execution_venue_time");
assert.equal(weekend.risk.book_max_spread_bps, 50);

const outside = draftSpec("When BTC breaks its 20-day range, rotate into majors' alts perps within 48 hours.");
assert.equal(outside.family, "unsupported");

const lead = draftSpec("The BTC hour before the open leads NVDA's first cash hour.");
assert.equal(lead.family, "lead_lag");
assert.equal(lead.leader, "BTCUSDT");
assert.deepEqual(lead.instruments, ["NVDAUSDT"]);
assert.deepEqual(lead.variants.map((item) => item.code), ["follow", "fade"]);

const kept = mergeCompiledDraft(close, { family: "session_timing", instruments: ["NVDAUSDT"], session_hour: 15 }, closeText(close));
assert.equal(kept.session_hour, 15);

const dropped = mergeCompiledDraft(
  close,
  { family: "session_timing", instruments: ["NVDAUSDT"] },
  "Trade NVDA in the last cash hour.",
);
assert.equal(dropped.session_hour, 15);

function closeText(spec: { session_hour?: number }): string {
  return spec.session_hour === 15 ? "Trade NVDA in the last cash hour." : "";
}

console.log("draft-spec ok");
