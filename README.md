# House Tracker

A private iPhone app (PWA) to track building our house: expenses, supplier debt, workers' weekly payments and what's left to finish. Amounts in Tunisian dinars (DT).

**Setting it up for the first time? Follow [docs/SETUP.md](docs/SETUP.md).**

> Sign-in is currently off: the app runs in local mode and keeps data on the phone. Set `VITE_ENABLE_LOGIN=true` plus the two Supabase variables to turn on accounts and sync between both phones.

## What it does

- **Home**: money needed to finish (remaining work + remaining supplier debt), spent, debt left, work left, % finished, a monthly spending chart, and reminder banners when a supplier or worker payment is due.
- **Expenses**: quick add from the blue **+** button, receipt photos, categories you can extend, search, filters (category, area, month), per-category breakdown, edit / duplicate / delete (swipe left on a row), CSV export.
- **Debt**: supplier setup (total owed, monthly payment, optional interest, payment window day 22–25), progress, months left, "Mark as paid" for each month, payment history, and purchases on credit that increase the debt.
- **Work**: areas (Ground floor, First floor, Second floor, Stair tower, Exterior, Roof, plus your own), tasks with estimated cost and status (tap the circle to move Not started → In progress → Done), bulk add, task and progress photos, % complete per area, and a remaining list with totals. Finishing a task offers to log its actual cost as an expense.
- **Workers**: agreed total price, weekly payment, start date, paid vs remaining, weeks left, weekly reminder, payment history.
- **Extras**: photo timeline per area, documents (quotes, contracts, invoices), optional 4-digit PIN, JSON backup and restore.

Supplier and worker payments are stored as expenses, so nothing is entered twice and every dashboard number is calculated from your data.

## How it's built

- React + Vite + TypeScript, `vite-plugin-pwa` for the service worker (works offline, installable from Safari).
- Supabase for email login, the shared database (Row Level Security limits every row and photo to your household) and live sync.
- Offline-first: changes are written to the phone first (`src/lib/store.ts`) and sent to Supabase when online. Photos are compressed and kept in IndexedDB until uploaded (`src/lib/photos.ts`).
- Deployed on Cloudflare Pages from the `main` branch.

| Path | What's in it |
|---|---|
| `supabase/schema.sql` | Tables, security rules, storage bucket. Run once in the Supabase SQL editor. |
| `src/lib/` | Data store and sync, calculations, formatting, photos, PIN, backup |
| `src/screens/` | One file per screen |
| `src/components/ui.tsx` | iOS-style building blocks: sheets, lists, swipe rows, segmented control, rings, toasts |

## Develop

```bash
npm install
cp .env.example .env.local   # add your Supabase URL and publishable/anon key
npm run dev
npm run build
```
