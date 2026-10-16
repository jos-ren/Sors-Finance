# Sors Finance

A privacy-focused, self-hosted personal finance app for budgeting, transaction categorization and net worth tracking. Your data lives in a single SQLite file on your own machine.

<img width="1716" height="1320" alt="image" src="https://github.com/user-attachments/assets/90860d51-1705-4232-b0f2-f842b6f4d3e8" />

## Features

- **Home dashboard**: answers two questions at a glance. Are you on track this month (left to spend, spending pace, last 12 months on or over budget), and is your net worth growing (trend with 1M / 3M / YTD / 1Y / All ranges).
- **Zero-based budgeting**: category groups and categories with monthly planned amounts, a budget builder, and yearly totals.
- **Bills, saving and spending**: mark categories as recurring bills or saving. Bills are tracked as paid, transfers to savings count as saving, and only everyday spending is paced.
- **Projects**: group the transactions from a trip, a move or a big purchase across categories and months, and see what it really cost. Big one-offs can be funded separately so they don't wreck the month.
- **Transaction import**: CSV and Excel (`.csv`, `.xlsx`, `.xls`) with auto-detected column mapping and saved templates, plus optional Plaid import.
- **Smart categorization**: your keywords (contains / starts with / exact match) first, then a built-in dictionary for first-time suggestions. Conflicts and unknowns land in a review inbox.
- **Accounts and net worth**: savings, investments, assets and debt, with live prices for stocks (Finnhub, Yahoo fallback), crypto (CoinGecko) and metals.
- **Automatic snapshots**: a daily net worth snapshot on first load, after Sync All, and on an optional schedule.
- **Privacy mode**: hide every amount with one click.
- **Backup and restore**: export all your data to JSON and import it again from Settings.

## Privacy First

- **Self-hosted**: runs entirely on your own hardware.
- **Local accounts**: users register and log in against your own database. Nothing is sent to a cloud service.
- **Minimal outbound calls**: only price lookups, exchange rates (Frankfurter) and Plaid, if you enable it.
- **Portable data**: one SQLite file you can back up or move.

## Quick Start

### Option 1: Docker

```bash
docker run -d \
  -p 127.0.0.1:3000:3000 \
  -v sors-data:/app/data \
  --name sors \
  ghcr.io/jos-ren/sors-finance:latest
```

Open http://localhost:3000 and register your first user.

> **Important**: the `-v sors-data:/app/data` flag persists your database. Without it, data is lost when the container is removed.

### Option 2: Docker Compose

```bash
git clone https://github.com/jos-ren/sors-finance.git
cd sors-finance
touch .env   # required by docker-compose.yml; add keys below if you use them
docker compose up -d
```

The port is bound to `127.0.0.1:3000` only, and data persists in the `sors-data` volume.

### Option 3: Development

```bash
git clone https://github.com/jos-ren/sors-finance.git
cd sors-finance
npm install
npm run dev
```

Open http://localhost:3000. Data is stored in `./data/sors.db`, and migrations run automatically on startup.

### Try it with sample data

`sors-test-data.json` in the repo root is a realistic two-year dataset: about 2,000 transactions, budgets, recurring bills, saving categories, projects (a Japan trip, a summer trip and an upcoming move), accounts and daily net worth snapshots. Load it from **Settings → Import Data**.

> **Warning**: importing a backup replaces all of the current user's data.

## Optional Integrations

All keys are environment variables, read only on the server. Create a `.env` file in the project root:

```bash
FINNHUB_API_KEY=<your-finnhub-key>
PLAID_CLIENT_ID=<your-plaid-client-id>
PLAID_SECRET=<your-plaid-secret>
# Optional: separate secrets per Plaid environment
PLAID_SECRET_SANDBOX=<your-sandbox-secret>
PLAID_SECRET_PRODUCTION=<your-production-secret>
```

For Portainer or another Docker UI, add the same variables to the stack's environment.

### Finnhub (stock prices)

Required only if you track stocks. Get a free key at [finnhub.io/register](https://finnhub.io/register) (60 calls per minute on the free tier). Crypto and metals prices need no key.

### Plaid (bank connections)

Plaid syncs account balances and imports transactions. **You bring your own Plaid developer account**, so you control and pay for your own usage.

1. Create an app at [dashboard.plaid.com](https://dashboard.plaid.com) and copy your `client_id` and secret.
2. Add them to `.env` and restart.
3. Go to **Settings → Plaid**, connect a bank, and choose a bucket (Savings, Investments, Assets or Debt) for each account.
4. Import transactions from **Transactions → Import → Connect with Plaid**. They go through the same categorization and review flow as file imports.

Plaid's free tier has limited transaction history; production use needs a paid plan. See [plaid.com/pricing](https://plaid.com/pricing).

## How Budgeting Works

- **Category groups** (Housing, Food…) contain **categories** (Rent, Groceries…). Transactions and monthly planned amounts attach to categories.
- **System categories**: Income, Excluded (transfers and card payments, ignored in totals) and Uncategorized.
- **Recurring bills**: toggle "Recurring bill" on a category. Home shows bills as paid of total, flags bills due in the next 7 days (from last month's payment day), and leaves them out of the spending pace.
- **Saving categories**: toggle "Saving" on a category (TFSA, Emergency Fund, a trip fund) and optionally set a target. Transfers into it count as saving, not spending, and the budget row shows progress toward the target.
- **Projects**: a project (Japan trip, Moving out, New car) is a label on transactions, separate from the category. A flight stays in Flights and also belongs to the Japan trip. Add transactions in bulk from the Transactions page, from the date-window suggestions on the project page, or automatically on import with project keywords (matched only between the project's dates).
- **Funded separately**: on by default for a project. Its spending is left out of left to spend, the pace line and the budget's category totals, and shown as its own line instead. It still counts against Saved, so Saved matches what happened to your net worth. Turn it off for small trips your monthly budget already covers.
- **Saved** on Home is income minus bills, spending and separately funded project spending. For the current month, Home also projects where you will land by month end.

More detail in [`docs/budget-system-strategy.md`](docs/budget-system-strategy.md), [`docs/plans/home-dashboard-plan.md`](docs/plans/home-dashboard-plan.md) and [`docs/spikes/goals-to-projects.md`](docs/spikes/goals-to-projects.md).

## Adding Bank Formats

Most banks work through the custom CSV import with auto-detected columns and saved templates (**Settings → Templates**). To add a dedicated parser:

1. Copy `lib/parsers/banks/_template.ts` to `lib/parsers/banks/yourbank.ts`.
2. Implement the `BankParser` interface.
3. Register it in `lib/parsers/index.ts`.

See [`lib/parsers/README.md`](lib/parsers/README.md).

## Tech Stack

- **Framework**: Next.js 16.1 (App Router), React 19.2, TypeScript 5
- **Database**: SQLite via better-sqlite3 12 and Drizzle ORM 0.45
- **Data fetching**: SWR 2
- **UI**: shadcn/ui (Maia style, zinc + lime) on Radix UI, Tailwind CSS 4
- **Charts**: Recharts 2.15
- **Tables and trees**: TanStack Table 8, Headless Tree, dnd-kit
- **File parsing**: PapaParse (CSV), SheetJS (Excel)
- **Auth**: bcrypt password hashing with cookie sessions
- **Scheduling**: node-cron 4 (production only)
- **Banking**: Plaid Node SDK

## Contributing

Contributions are welcome: bank formats, bug fixes, features and docs. Please open an issue first to discuss major changes.

## License

[MIT](LICENSE). Free to use, modify and distribute.
