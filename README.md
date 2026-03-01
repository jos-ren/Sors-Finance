# Sors Finance

A privacy-focused, self-hosted personal finance app for budget tracking, transaction categorization, and net worth management. All your data stays on your server — nothing is sent to external services.

<img width="1277" height="950" alt="Screenshot 2026-01-01 214456" src="https://github.com/user-attachments/assets/0d05b80b-afbe-4bf1-89a9-7ead90287808" />

## Features

- **Transaction Import** — Import bank statements (CSV/Excel) with automatic bank detection
- **Smart Categorization** — Keyword-based auto-categorization with conflict resolution
- **Budget Tracking** — Set monthly budgets per category and track spending progress
- **Net Worth Dashboard** — Track savings, investments, assets, and debt over time
- **Portfolio Tracking** — Monitor stocks and crypto with optional price lookups
- **Automatic Snapshots** — Daily portfolio snapshots at a configurable time
- **Privacy Mode** — Hide sensitive amounts with a single click
- **Data Export** — Export and Import all your data anytime

## Privacy First

Your financial data stays on your machine. Sors uses a local SQLite database — no accounts, no cloud sync, no tracking. You own your data completely.

- **Self-hosted**: Runs entirely on your own hardware
- **No external services**: Only outbound calls are optional stock/crypto price lookups and Plaid (if you enable it)
- **Portable data**: Single SQLite file you can backup or migrate

## Plaid Integration (Optional)

Sors supports optional Plaid integration for automatic transaction imports and balance syncing. **You bring your own Plaid developer account** — this keeps your data under your control and lets you use Plaid's free tier.

### Features

- **Automatic Transaction Import**: Fetch transactions directly from your connected banks
- **Balance Syncing**: Keep portfolio account balances up-to-date automatically
- **Multi-Bank Support**: Connect multiple banks with a single Plaid account
- **Scheduler Integration**: Daily balance sync runs with portfolio snapshots

### Setup

1. **Create a Free Plaid Developer Account**
   - Go to [dashboard.plaid.com](https://dashboard.plaid.com)
   - Sign up and create a new application
   - Get your `client_id` and `secret` (works for sandbox, development, and production)

2. **Get a Free Finnhub API Key**
   - Go to [finnhub.io/register](https://finnhub.io/register)
   - Sign up and get your API key (60 API calls/minute free tier)

3. **Configure Environment Variables**
   
   **For Local Development:**
   ```bash
   # Copy the example file
   cp .env.example .env
   
   # Edit .env and add your API keys:
   PLAID_CLIENT_ID=your_plaid_client_id_here
   PLAID_SECRET=your_plaid_secret_here
   FINNHUB_API_KEY=your_finnhub_api_key_here
   ```
   
   **For Docker CLI:**
   - Same as above - Docker Compose automatically loads the `.env` file
   
   **For Portainer/Docker UI:**
   - In your stack configuration, add these environment variables:
     - `PLAID_CLIENT_ID`
     - `PLAID_SECRET`
     - `FINNHUB_API_KEY`

4. **Connect Your Banks**
   - Start the app and go to Settings → Integrations
   - Click "Connect a Bank"
   - Follow Plaid Link flow to connect your accounts
   - Choose portfolio bucket (Savings/Investments/Assets/Debt) for each account
   - Balances sync automatically

5. **Import Transactions**
   - Go to Transactions page → Import
   - Choose "Connect with Plaid"
   - Select institution, accounts, and date range
   - Transactions flow through the same categorization pipeline as manual imports

### Security

- API keys stored as environment variables (never in database)
- All credentials only accessible server-side
- Multi-user households share API keys (appropriate for self-hosted apps)

### Pricing

Plaid offers a free Development tier with limited transaction history. Production usage requires paid plans. Since you use your own API credentials, you control and pay for your own usage. See [plaid.com/pricing](https://plaid.com/pricing) for details.

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker run -d \
  -p 3000:3000 \
  -v sors-data:/app/data \
  --name sors \
  ghcr.io/jos-ren/sors-finance:latest
```

Then open http://localhost:3000

> **Important**: The `-v sors-data:/app/data` flag persists your database. Without it, data is lost when the container restarts.

### Option 2: Docker Compose

```bash
git clone https://github.com/jos-ren/sors-finance.git
cd sors-finance
docker compose up -d
```

Data is automatically persisted via the configured volume.

### Option 3: Development

```bash
git clone https://github.com/jos-ren/sors-finance.git
cd sors-finance
npm install
npm run dev
```

Open http://localhost:3000

Data is stored in `./data/sors.db`.

## CSV Import

Sors Finance supports flexible CSV import through custom column mapping:

- **Custom Import** - Map any CSV format to transaction fields
- **Saved Templates** - Save your column mappings for reuse
- **Auto-Detection** - Column headers and types are detected automatically

Don't see your specific format? Use the custom import wizard with auto-detected column mapping!

## Adding Bank Support

The parser system is designed for easy extension:

1. Copy `lib/parsers/banks/_template.ts` to `lib/parsers/banks/yourbank.ts`
2. Implement the `BankParser` interface
3. Register in `lib/parsers/index.ts`

See `lib/parsers/README.md` for detailed documentation.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **UI**: shadcn/ui + Radix UI + Tailwind CSS
- **Charts**: Recharts
- **File Parsing**: PapaParse (CSV) + SheetJS (Excel)
- **Scheduling**: node-cron (for automatic snapshots)

## Contributing

Contributions are welcome! Whether it's:

- Adding support for new banks
- Bug fixes
- Feature improvements
- Documentation

Please open an issue first to discuss major changes.

## License

[MIT](LICENSE) — Free to use, modify, and distribute.
