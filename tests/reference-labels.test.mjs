import assert from "node:assert/strict";
import test from "node:test";
import { layoutReferenceLabels } from "../src/features/payoff/referenceLabels.ts";

const marker = (key, value, text = key) => ({ key, value, text });

test("nearby spot and breakevens get separate annotation rows on a phone", () => {
  const labels = layoutReferenceLabels([
    marker("spot", 5222, "Spot ₹5,222"), marker("be", 5186, "₹5,186"),
  ], [4438, 6304], 240);
  assert.notEqual(labels[0].row, labels[1].row);
  assert.equal(labels[0].value, 5222);
  assert.equal(labels[1].value, 5186);
});

test("well separated references retain one row and their actual horizontal anchors", () => {
  const labels = layoutReferenceLabels([
    marker("spot", 2512, "Spot ₹2,512"), marker("be", 2438, "₹2,438"),
  ], [2100, 2900], 980);
  assert.deepEqual(labels.map(({ row, dx }) => ({ row, dx })), [{ row: 0, dx: 0 }, { row: 0, dx: 0 }]);
});

test("edge labels stay inside the plot and coincident references never share a row", () => {
  const labels = layoutReferenceLabels([
    marker("low", 0, "₹0"), marker("same", 0, "Spot ₹0"), marker("high", 100, "₹100"),
  ], [0, 100], 140);
  assert.notEqual(labels[0].row, labels[1].row);
  for (const label of labels) {
    const center = label.value / 100 * 140 + label.dx;
    const half = (label.text.length * 7 + 8) / 2;
    assert.ok(center - half >= 0);
    assert.ok(center + half <= 140);
  }
});

test("zoom excludes off-screen and invalid references without changing source data", () => {
  const markers = [marker("low", 10), marker("in", 50), marker("high", 90), marker("bad", NaN)];
  const original = structuredClone(markers);
  assert.deepEqual(layoutReferenceLabels(markers, [40, 60], 300).map((label) => label.key), ["in"]);
  assert.deepEqual(markers, original);
  assert.deepEqual(layoutReferenceLabels(markers, [40, 60], 0), []);
});
