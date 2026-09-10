import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRecipe,
  baselineFromPayoff,
  changeDraftContract,
  closeDraft,
  draftFromChain,
  useLatestPrice,
  validDraft,
  withManualPrice,
} from '../src/features/strategy-builder/scenarioState.ts';

const fetchedAt = '2026-09-10T06:00:00Z';
const observation = (value, priceKnown = true) => ({
  value, priceKnown, fetchedAt, quotedAt: null, sourceConnectionId: 'alice',
  status: priceKnown ? 'AVAILABLE' : 'UNAVAILABLE', openInterest: 100,
});
const row = (strike, lotSize = 1600, call = 10, put = 11) => ({
  strike, lotSize, tickSize: 0.05, metadataConflict: false,
  call: observation(call, call !== null), put: observation(put, put !== null),
  callSymbol: `ITC-C-${strike}`, putSymbol: `ITC-P-${strike}`,
});
const chain = {
  underlying: 'ITC', expiry: '2026-09-24', exchange: 'NSE',
  sourceConnectionId: 'alice', sourceBrokerId: 'aliceblue', sourceLabel: 'AB1',
  spot: 451, fetchedAt, quotedAt: null, availability: 'AVAILABLE', warnings: [],
  rows: [row(440), row(450, 1600, 12, 9), row(460, 1600, 4, 14), row(480)],
};

test('live import preserves structural facts, exact units, cost, origin and mark', () => {
  const imported = baselineFromPayoff({
    underlying: 'ITC', brokerId: 'kite', connectionId: 'kite-itc', spot: 451,
    isIndex: false, payoff: {}, expiries: ['2026-09-24'], retrievedAt: fetchedAt, complete: true,
    warnings: [], holding: {},
    legs: [{ legId: 'held-1', symbol: 'ITC24SEP450CE', underlying: 'ITC', exchange: 'NSE',
      strike: 450, type: 'CE', qty: -127, avgPrice: 12, expiry: '2026-09-24',
      lotSize: 1600, origin: 'EXISTING_POSITION', currentMark: 10, currentMarkKnown: true }],
  });
  assert.equal(imported[0].qty, -127);
  assert.equal(imported[0].entryPrice, 12);
  assert.equal(imported[0].contract.expiry, '2026-09-24');
  assert.equal(imported[0].lotSize, 1600);
  assert.equal(imported[0].origin, 'EXISTING_POSITION');
  assert.equal(imported[0].currentMark.value, 10);
});

test('chain selection copies a quote once and refresh does not overwrite a manual assumption', () => {
  const draft = draftFromChain(chain, chain.rows[2], 'CE', 'BUY', 'draft-1');
  assert.equal(draft.entryPrice, 4);
  assert.equal(draft.qty, 1600);
  const manual = withManualPrice(draft, 5.5);
  assert.equal(manual.entryPrice, 5.5);
  assert.equal(manual.priceBasis, 'MANUAL');
  assert.equal(manual.currentMark.value, 4);
  assert.equal(useLatestPrice(manual, observation(6)).entryPrice, 6);
});

test('missing quote creates a visible unpriced draft instead of inventing a premium', () => {
  const unquoted = row(470, 1600, null, 8);
  const draft = draftFromChain(chain, unquoted, 'CE', 'BUY', 'unpriced');
  assert.equal(draft.entryPrice, null);
  assert.equal(validDraft(draft), false);
  assert.equal(validDraft({ ...draft, enabled: false }), true);
});

test('contract change invalidates the old quote and recipe uses actual chain rows and lot size', () => {
  const draft = draftFromChain(chain, chain.rows[1], 'CE', 'BUY', 'draft-1');
  const changed = changeDraftContract(draft, { strike: 460 }, 1600);
  assert.equal(changed.entryPrice, null);
  assert.equal(changed.entryQuote, null);
  assert.equal(changed.currentMark, null);

  const recipe = { id: 'BULL_CALL_SPREAD', label: 'Bull Call Spread', sentiment: 'Bullish',
    description: '', legs: [{ strikeOffset: 0, type: 'CE', quantityLots: 1 },
      { strikeOffset: 1, type: 'CE', quantityLots: -1 }] };
  const applied = applyRecipe(recipe, chain, 'recipe');
  assert.deepEqual(applied.legs.map(leg => [leg.contract.strike, leg.qty, leg.entryPrice]),
    [[450, 1600, 12], [460, -1600, 4]]);
  assert.equal(applied.missing, 0);
});

test('closing is an opposite trade and retains its link to the immutable leg', () => {
  const existing = {
    id: 'existing', contract: { underlying: 'ITC', expiry: '2026-09-24', strike: 450, type: 'CE' },
    exchange: 'NSE', lotSize: 1600, qty: -1600, entryPrice: 12,
    priceBasis: 'POSITION_AVERAGE', entryQuote: null, currentMark: observation(7),
    origin: 'EXISTING_POSITION', enabled: true, closesLegId: null,
  };
  const close = closeDraft(existing, 7);
  assert.equal(close.qty, 1600);
  assert.equal(close.entryPrice, 7);
  assert.equal(close.closesLegId, 'existing');
  assert.equal(existing.qty, -1600);
});
