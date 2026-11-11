# Fundamentals extraction

Turns a company's quarterly result filings into `public/fundamentals/<SYMBOL>.json`, which the
stock page (`/app/stocks/<SYMBOL>`) reads. The same script serves every stock.

## Run

```powershell
node scripts/fundamentals/extract-filings.mjs ITC
```

It reads `links/ITC.txt`. Either of these works, and they can be mixed:

- **NSE's results table, as exported or pasted** (tab- or comma-separated, header row and all):
  NSE → Corporate filings → Financial results → the company → download. The script picks the
  XBRL address out of each row and skips rows where NSE has no file (`.../xbrl/-`).
- **One address or saved-file path per line.** Lines starting with `#` are comments.

One filing holds one quarter on one basis (consolidated or standalone). The script does not
read NSE's listing pages itself; the links are collected by hand.

## What it does

- Fetches each address once (2 s apart, identifying itself) and keeps the file in `cache/`.
- `parse-filing.mjs` reads two formats into the same shape, amounts in rupees:
  - XBRL `.xml` under `/corporate/xbrl/` (quarters up to December 2024): the quarter's facts,
    from the context `OneD`.
  - "Integrated Filing — IndAS" `.html` under `/corporate/ixbrl/` (later quarters): the result
    rows by label, converted from the filing's rounding level.
- Refuses a filing whose NSE symbol is not the one asked for, and any other format.
- A revised filing for the same quarter replaces the earlier one.

## Limits

- Banks, NBFCs and insurers file a different statement and are refused.
- Results only: no balance sheet, cash flow, shareholding or dividends.
- Figures are as filed. A later restatement (a demerger, say) is not applied to earlier quarters.

Tests: `tests/stock-fundamentals.test.mjs`.
