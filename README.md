# Sors Finance

A privacy-focused, self-hosted personal finance app for budget tracking, transaction categorization, and net worth management. All your data stays on your server — nothing is sent to external services.

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

2. **Generate Encryption Key**
   - In Sors Settings → Integrations, use the built-in key generator
   - Copy the generated 64-character hex key
   - Add to your `.env.local` file:
     ```
     PLAID_ENCRYPTION_KEY=your_64_character_hex_key_here
     ```
   - For Docker, add as environment variable in `docker-compose.yml`

3. **Add Plaid Credentials in Settings**
   - Go to Settings → Integrations → Plaid Banking Integration
   - Enter your Plaid `client_id` and `secret`
   - Test connection to verify

4. **Connect Your Banks**
   - Click "Connect a Bank" in Settings
   - Follow Plaid Link flow to connect your accounts
   - Portfolio accounts are created automatically

5. **Import Transactions**
   - Go to Transactions page → Import
   - Choose "Connect with Plaid"
   - Select institution, accounts, and date range
   - Transactions flow through the same categorization pipeline as manual imports

### Security

- All Plaid credentials and access tokens are encrypted using AES-256-GCM
- Encryption key is stored in your environment variables (never in the database)
- Each user's credentials are encrypted separately
- Access tokens are never logged or exposed

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

## Supported Banks

Sors auto-detects your bank from the exported file:

- CIBC
- American Express

Don't see your bank? [Add a parser](#adding-bank-support) or open an issue!

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
