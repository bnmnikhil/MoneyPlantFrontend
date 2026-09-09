import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultRange, chartPoints, rangeAnchor, validRange } from '../src/features/payoff/chartRange.ts';

const leg = (type, strike, qty = 1, avgPrice = 10) => ({ type, strike, qty, avgPrice });
test('indices default to ten percent, stocks to fifteen percent', () => {
  assert.deepEqual(defaultRange(24000, true, [], []), [21600, 26400.000000000004]);
  assert.deepEqual(defaultRange(100, false, [], []), [85, 114.99999999999999]);
});
test('auto includes distant strikes and breakevens with padding, but not entry cost alone', () => {
  const legs = [leg('EQ', 0, 100, 5), leg('CE', 140, -100)];
  assert.deepEqual(defaultRange(100, false, legs, [75]), [73, 142]);
  assert.equal(defaultRange(100, false, [leg('EQ', 0, 100, 5)], [])[0], 85);
  assert.equal(defaultRange(100, false, [leg('CE', 900, 0)], [])[1], 114.99999999999999);
});
test('unknown spot uses strikes first, then linear entry prices', () => {
  assert.equal(rangeAnchor(0, [leg('EQ', 0, 100, 5), leg('CE', 100)]), 100);
  assert.equal(rangeAnchor(0, [leg('FUT', 0, 65, 24000)]), 24000);
});
test('custom range rejects invalid bounds', () => {
  for (const pair of [[-1, 2], [2, 2], [3, 2], [NaN, 2], [0, Infinity]]) assert.equal(validRange(...pair), false);
  assert.equal(validRange(0, 500), true);
});
test('resampling retains exact option corners and prices beyond old chart bounds', () => {
  const legs = [leg('EQ', 0, 100, 500), leg('CE', 550, -100, 10)];
  const points = chartPoints(legs, [0, 2000], [490]);
  assert.deepEqual(points[0], { spot: 0, pnl: -49000 });
  assert.deepEqual(points.at(-1), { spot: 2000, pnl: 6000 });
  assert.deepEqual(points.find(p => p.spot === 490), { spot: 490, pnl: 0 });
  assert.deepEqual(points.find(p => p.spot === 550), { spot: 550, pnl: 6000 });
  assert.equal(chartPoints(legs, [600, 800]).every(p => p.pnl === 6000), true);
});
