import assert from "node:assert/strict";
import { mapVerdict } from "./map-verdict.ts";
import { presentVerdict } from "./present-verdict.ts";

const report = mapVerdict(
  {
    label: "UNTESTABLE",
    n_units: { n: 1 },
    required_units: 60,
    units_short: 59,
    n_events: 1,
    engine_version: "killlab-0.13.1",
    mechanism: "funding_hold_versus_cash",
    run_origin: "manual",
    spec_sha256: "351828e1ec285105b896a92667e60b26922ea907b69454a09e71e9c142b6e892",
    book_capture: {
      provenance: "forward_recorded",
      historical: false,
      spread_bps: 0.012,
      walk_notional_usd: 10000,
      walk_round_trip_bps: 0.012,
      depth_imbalance: -0.481,
      ts: "1790729196370",
    },
    next_question: "Keep this frozen spec.",
    research_context: {
      usable_for_verdict: false,
      routing: { skill: "sentiment-analyst" },
      items: [
        {
          category: "SKILL CONTEXT",
          summary: "The official tool answered and supplied no numeric fields.",
          current_or_historical: "unknown",
          tool_name: "sentiment_index",
          source_class: "official_signal_mcp",
          failure_class: "empty_result",
          source_url: "https://datahub.noxiaohao.com/mcp",
          content_hash: "e9135c0f782d",
          retrieved_at: "2026-09-30T00:47:08+00:00",
        },
        {
          category: "SKILL CONTEXT",
          summary: "symbol BTCUSDT; long_short_account_ratio 1.6253; taker_buy_volume 237.116",
          current_or_historical: "current",
          tool_name: "account_long_short",
          source_class: "bitget_public_rest",
          failure_class: "valid_data",
          source_url: "https://api.bitget.com/api/v2/mix/market/account-long-short",
          retrieved_at: "2026-09-30T00:47:08+00:00",
          data_timestamp: "2026-09-30T00:00:00+00:00",
        },
      ],
    },
  },
  "Is BTC crowd positioning one-sided while funding is harvested against cash?",
);

const view = presentVerdict(report);
assert.equal(view.observed, "1");
assert.equal(view.required, "60");
assert.equal(view.gap, "59");
assert.equal(view.skill, "sentiment-analyst");
assert.equal(view.contextChanges, "no");
assert.equal(view.book?.provenance, "forward-recorded");
assert.equal(view.book?.spread, "0.012");
assert.equal(view.book?.historical, "no");
assert.equal(view.contexts[0]?.sourceClass, "official_signal_mcp");
assert.equal(view.contexts[0]?.failureClass, "empty_result");
assert.equal(view.contexts[1]?.title, "Long/short ratio");
assert.equal(view.contexts[1]?.sourceClass, "bitget_public_rest");
assert.notEqual(view.contexts[1]?.title, "Official Signal");
assert.ok(view.contexts[1]?.facts.some((fact) => fact.value === "1.6253"));
console.log("present-verdict ok");
