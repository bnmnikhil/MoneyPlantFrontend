import test from 'node:test';
import assert from 'node:assert/strict';
import { RATE, bsPrice, cdf, daysToLastExpiry, impliedVol, intrinsic, istDate, prepareProjection, projectedBreakevens, projectedPnl, targetMoment, yearsToExpiry } from '../src/features/payoff/projection.ts';
import { chartPoints } from '../src/features/payoff/chartRange.ts';

const close = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ''} expected ${expected}, got ${actual}`);

// 10 Oct 2026, 12:00 IST. Expiry 27 Oct 2026 at 15:30 IST.
const NOW = new Date('2026-10-10T06:30:00Z');
const EXPIRY = '2026-10-27';

test('reference prices match the backend BlackScholesTest exactly', () => {
  close(bsPrice(24000, 23500, 0.25, 0.14, true), 1188.420254, 1e-6);
  close(bsPrice(24000, 23500, 0.25, 0.14, false), 309.631250, 1e-6);
  close(bsPrice(58164, 58700, 17 / 365, 0.13, true), 489.314379, 1e-6);
});

test('normal CDF and put-call parity', () => {
  close(cdf(0), 0.5, 1e-9);
  close(cdf(1), 0.8413447, 1e-6);
  const s = 24000, k = 23500, t = 0.25;
  close(bsPrice(s, k, t, 0.14, true) - bsPrice(s, k, t, 0.14, false), s - k * Math.exp(-RATE * t), 1e-8);
});

test('at or past expiry an option is worth its intrinsic value', () => {
  assert.equal(bsPrice(24500, 24000, 0, 0.15, true), 500);
  assert.equal(bsPrice(23500, 24000, 0, 0.15, false), 500);
  assert.equal(yearsToExpiry('2026-10-10', new Date('2026-10-10T10:00:01Z')), 0);
});

test('expiry is 15:30 IST on the expiry date', () => {
  close(yearsToExpiry(EXPIRY, NOW), (17 * 24 + 3.5) / (365 * 24), 1e-12);
});

test('implied volatility round-trips across moneyness and tenor', () => {
  for (const [s, k, t, vol] of [[24000, 24000, 0.05, 0.12], [24000, 23000, 0.1, 0.18], [24000, 25000, 0.1, 0.16], [58164, 56200, 0.047, 0.2]]) {
    for (const call of [true, false]) {
      const solved = impliedVol(bsPrice(s, k, t, vol, call), s, k, t, call);
      assert.ok(solved !== null, `no solve for ${s}/${k}/${t}/${vol}/${call}`);
      close(solved, vol, 1e-4);
    }
  }
});

test('refuses to invent a volatility when the price carries none', () => {
  assert.equal(impliedVol(500, 24500, 24000, 0.1, true), null);   // at intrinsic
  assert.equal(impliedVol(25000, 24000, 24000, 0.1, true), null); // above the underlying
  assert.equal(impliedVol(100, 24000, 24000, 0, true), null);     // expired
});

// The staging iron condor: BANKNIFTY, 35 units a leg, each leg marked by Black-Scholes at its own vol.
const SPOT = 58164;
const years = yearsToExpiry(EXPIRY, NOW);
const marked = (type, strike, qty, avgPrice, vol) =>
  ({ type, strike, qty, avgPrice, expiry: EXPIRY, currentMarkKnown: true, currentMark: bsPrice(SPOT, strike, years, vol, type === 'CE') });
const condor = [
  marked('PE', 56700, -35, 376.6, 0.19),
  marked('PE', 56200, 35, 261.45, 0.2),
  marked('CE', 58700, -35, 495, 0.15),
  marked('CE', 59200, 35, 359.15, 0.155),
];
const openPnl = (legs) => legs.reduce((sum, leg) => sum + (leg.currentMark - leg.avgPrice) * leg.qty, 0);

test('the today curve passes through Current P/L at spot', () => {
  const projection = prepareProjection(condor, SPOT, NOW);
  assert.ok(projection);
  assert.equal(projection.borrowedVol, 0);
  close(projectedPnl(projection, SPOT), openPnl(condor), 0.01);
});

test('the today curve converges on the expiry curve at expiry', () => {
  const atExpiry = new Date('2026-10-27T10:00:00Z');
  const projection = prepareProjection(condor, SPOT, atExpiry);
  for (const point of chartPoints(condor, [52000, 64000])) {
    close(projectedPnl(projection, point.spot), point.pnl, 0.01, `at ${point.spot}`);
  }
});

test('a leg with no usable mark borrows the nearest-the-money volatility, and says so', () => {
  const legs = [...condor.slice(0, 3), { ...condor[3], currentMarkKnown: false, currentMark: null }];
  const projection = prepareProjection(legs, SPOT, NOW);
  assert.equal(projection.borrowedVol, 1);
  assert.ok(Number.isFinite(projectedPnl(projection, SPOT)));
});

test('futures and shares move one-for-one with spot and keep their basis', () => {
  const fut = { type: 'FUT', strike: 0, qty: 35, avgPrice: 58000, expiry: EXPIRY, currentMarkKnown: true, currentMark: 58400 };
  const projection = prepareProjection([fut], SPOT, NOW);
  close(projectedPnl(projection, SPOT), (58400 - 58000) * 35, 0.01);
  close(projectedPnl(projection, SPOT + 100), (58500 - 58000) * 35, 0.01);
});

test('no curve without a spot, or when no leg yields any volatility', () => {
  assert.equal(prepareProjection(condor, 0, NOW), null);
  const unpriced = condor.map((leg) => ({ ...leg, currentMarkKnown: false, currentMark: null }));
  assert.equal(prepareProjection(unpriced, SPOT, NOW), null);
});

test('the date in India rolls over at midnight IST, not UTC', () => {
  assert.equal(istDate(new Date('2026-10-10T18:29:00Z')), '2026-10-10');
  assert.equal(istDate(new Date('2026-10-10T18:30:00Z')), '2026-10-11');
});

test('the slider runs in calendar days from today to the last open expiry', () => {
  assert.equal(daysToLastExpiry(condor, NOW), 17);
  const mixed = [...condor, { ...condor[0], expiry: '2026-11-24' }, { ...condor[1], qty: 0, expiry: '2026-12-29' }];
  assert.equal(daysToLastExpiry(mixed, NOW), 45);
  assert.equal(daysToLastExpiry(condor, new Date('2026-10-27T12:00:00Z')), 0);
});

test('a target day is valued at that day\'s 15:30 IST close; day 0 is now', () => {
  assert.equal(targetMoment(NOW, 0), NOW);
  assert.equal(targetMoment(NOW, 3).toISOString(), '2026-10-13T10:00:00.000Z');
  // 22:00 IST on 10 Oct: tomorrow is 11 Oct.
  assert.equal(targetMoment(new Date('2026-10-10T16:30:00Z'), 1).toISOString(), '2026-10-11T10:00:00.000Z');
});

test('at the last expiry the target curve is the expiry curve', () => {
  const projection = prepareProjection(condor, SPOT, NOW, targetMoment(NOW, daysToLastExpiry(condor, NOW)));
  for (const point of chartPoints(condor, [52000, 64000])) {
    close(projectedPnl(projection, point.spot), point.pnl, 0.01, `at ${point.spot}`);
  }
});

test('a short condor inside its wings gains as the target date nears expiry', () => {
  const pnlOn = (days) => projectedPnl(prepareProjection(condor, SPOT, NOW, targetMoment(NOW, days)), SPOT);
  assert.ok(pnlOn(7) > pnlOn(0));
  assert.ok(pnlOn(14) > pnlOn(7));
});

test('a leg past its own expiry at the target counts at intrinsic', () => {
  const near = { ...condor[2], expiry: '2026-10-20' };
  const target = targetMoment(NOW, 12); // 22 Oct: the near leg has expired, the rest have not
  const projection = prepareProjection([near, ...condor.slice(0, 2), condor[3]], SPOT, NOW, target);
  const rest = prepareProjection([...condor.slice(0, 2), condor[3]], SPOT, NOW, target);
  for (const spot of [57000, 58164, 59500]) {
    close(projectedPnl(projection, spot),
      projectedPnl(rest, spot) + (intrinsic(spot, near.strike, true) - near.avgPrice) * near.qty, 0.02, `at ${spot}`);
  }
});

test('a future\'s basis shrinks to nothing at its expiry', () => {
  const fut = { type: 'FUT', strike: 0, qty: 35, avgPrice: 58000, expiry: EXPIRY, currentMarkKnown: true, currentMark: 58400 };
  const atExpiry = prepareProjection([fut], SPOT, NOW, targetMoment(NOW, 17));
  close(projectedPnl(atExpiry, SPOT), (SPOT - 58000) * 35, 0.01);
});

test('target breakevens: the expiry ones at expiry, and real zeros before it', () => {
  // Net credit 251 a unit: breakevens at 56,700 - 251 and 58,700 + 251.
  const atExpiry = prepareProjection(condor, SPOT, NOW, targetMoment(NOW, 17));
  const roots = projectedBreakevens(atExpiry, [52000, 64000]);
  assert.equal(roots.length, 2);
  close(roots[0], 56449, 0.02);
  close(roots[1], 58951, 0.02);

  const today = prepareProjection(condor, SPOT, NOW);
  for (const root of projectedBreakevens(today, [52000, 64000])) {
    assert.ok(Math.abs(projectedPnl(today, root)) < 1, `P&L at ${root}`);
  }
  assert.deepEqual(projectedBreakevens(today, [60000, 60000]), []);
});
