import test from 'node:test';
import assert from 'node:assert/strict';
import { legPnlAtSpot, quantityStep } from '../src/features/strategy-builder/payoffMath.ts';

test('covered call inspector includes shares at purchase cost', () => {
  const legs = [
    { type: 'EQ', strike: 0, price: 500, qty: 100 },
    { type: 'CE', strike: 550, price: 10, qty: -100 },
  ];
  const pnl = spot => legs.reduce((sum, leg) => sum + legPnlAtSpot(leg, spot), 0);
  assert.equal(pnl(0), -49000);
  assert.equal(pnl(490), 0);
  assert.equal(pnl(550), 6000);
  assert.equal(pnl(800), 6000);
});

test('equity edits use single shares and futures retain linear payoff', () => {
  assert.equal(quantityStep('EQ', 500), 1);
  assert.equal(quantityStep('CE', 500), 500);
  assert.equal(legPnlAtSpot({ type: 'FUT', strike: 0, price: 500, qty: 100 }, 550), 5000);
});
