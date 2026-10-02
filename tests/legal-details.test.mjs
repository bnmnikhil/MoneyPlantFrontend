import assert from "node:assert/strict";
import test from "node:test";
import { unfilledLegalDetails } from "../src/features/legal/details.ts";

test("bracketed placeholders are reported as unfilled", () => {
  assert.deepEqual(
    unfilledLegalDetails({ operatorName: "[Operator's full legal name]", contactEmail: "a@b.in" }),
    ["operatorName"],
  );
});

test("filled details report nothing, even with brackets-free punctuation", () => {
  assert.deepEqual(unfilledLegalDetails({ pricing: "Free (for now).", city: "Hyderabad" }), []);
});
