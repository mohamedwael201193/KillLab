import assert from "node:assert/strict";
import { failureMessage, isTransient, retryDelayMs } from "./reliability.ts";
import { reconcileFieldError } from "./fills.ts";
import { postureFromReasons } from "./constitution.ts";

assert.equal(isTransient(502), true);
assert.equal(isTransient(503), true);
assert.equal(isTransient(504), true);
assert.equal(isTransient(404), false);
assert.equal(retryDelayMs(0), 400);
assert.equal(retryDelayMs(1), 800);
assert.ok(retryDelayMs(8) <= 4000);
assert.match(failureMessage(502, "http_502"), /did not answer/);
assert.equal(reconcileFieldError("", "10"), "Enter both a buy price and a sell price.");
assert.equal(reconcileFieldError("0", "10"), "Prices must be numbers above zero.");
assert.equal(reconcileFieldError("10.5", "9"), null);
assert.equal(postureFromReasons(["Constitution posture is conservative; universe NVDA."]), "conservative");
assert.equal(postureFromReasons(["This run is KILLED with primary trap contradicted."]), null);

console.log("reliability ok");
