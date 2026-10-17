# Timbertop: loan and college

A home loan, offset and college fund tracker. Make plans, record what really happens, check in your
statement balances, and see how far ahead of the bank's schedule you are. Everything runs in the
browser; nothing is sent anywhere.

Live at https://gaurav0302.github.io/Loan-Planner/

## What it does

- **Dashboard**: when the loan will be paid off on your real balances, college funds against their goals,
  time and interest saved against the bank's minimum repayments, a net-debt chart, this month's money,
  what's coming up and a year-by-year table.
- **Plans**: several plans, one active at a time. Each holds its starting values and its own guesses about
  the future (rate moves, a year on one income, lump sums). Compare them side by side, and see what one
  change does in the "what if one thing changed" list.
- **Record**: things that really happened (a rate change and what the bank did with the repayment, more or
  less into the offset, a pay rise, a lump sum) apply to every plan from their month on. Earlier months
  never change. Monthly balance check-ins restart every projection from the real figures.
- **Settings**: light or dark theme, backup to a file, restore from one, and start again.

It can be installed to a phone or desktop home screen and works offline.

## Your data

Data lives in this browser's local storage under `timbertop:data`. On first visit the app brings over
the previous planner's settings, saved plans and defaults from the same browser. The previous planner
stays available at `classic/` and keeps its own copy. Use Settings › Save a backup file to keep a copy
or move to another device.

## Developing

Needs Node 22.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine, data and dashboard tests
npm run build      # type-check and build into dist/
npm run preview    # serve the built app
```

- `src/engine`: the month-by-month calculation. `simulate.test.ts` checks it against the original
  planner's calculation (`classic.fixture.ts`) across many scenarios, plus the two deliberate changes:
  months where costs exceed pay now draw from the offset, and unallocated money is reported.
- `src/data`: the saved data format, import from the previous planner, backups, plans, check-ins and the
  dashboard figures.
- `src/screens`, `src/components`, `src/styles`: the interface.
- `public/classic/index.html`: the previous planner, unchanged.
- `scripts/make-icons.mjs`: draws the app icons into `public/icons`.

While developing, setting `localStorage['timbertop:today'] = '2027-06'` pretends it is that month, so
check-ins can be tried before the loan starts. It has no effect in the published build.

## Publishing

Every push to `main` runs the tests, builds the app and publishes `dist/` to GitHub Pages
(`.github/workflows/pages.yml`). A failing test stops the publish.
