import test from 'node:test';
import assert from 'node:assert/strict';
import { holdingView } from '../src/features/payoff/holdingView.ts';

test('combined chart uses its own holding quantity and cost after a refresh', () => {
  const base = { availableQty: 100, includedQty: 0, avgCost: 500, warning: null };
  const combined = { availableQty: 80, includedQty: 80, avgCost: 510, warning: null };
  assert.equal(holdingView(true, base, combined), combined);
  assert.equal(holdingView(false, base, combined), base);
  assert.equal(holdingView(true, base, undefined), base);
});
