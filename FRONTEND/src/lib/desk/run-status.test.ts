import assert from "node:assert/strict";
import { runStatusLine } from "./run-status.ts";

assert.equal(runStatusLine("running"), "Engine running");
assert.equal(runStatusLine("queued"), "Engine running");
assert.equal(runStatusLine("succeeded"), "Engine finished");
assert.equal(runStatusLine("untestable"), "Engine finished");
assert.equal(runStatusLine("failed"), "Run failed");
assert.equal(runStatusLine(undefined), "Waiting for the engine");
console.log("run-status ok");
