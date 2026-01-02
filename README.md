# Sors Finance

A privacy-focused, local-first personal finance app for budget tracking, transaction categorization, and net worth management. All your data stays on your device — nothing is sent to external servers.

<img width="1277" height="950" alt="Screenshot 2026-01-01 214456" src="https://github.com/user-attachments/assets/0d05b80b-afbe-4bf1-89a9-7ead90287808" />

## Features

- **Transaction Import** — Import bank statements (CSV/Excel) with automatic bank detection
- **Smart Categorization** — Keyword-based auto-categorization with conflict resolution
- **Budget Tracking** — Set monthly budgets per category and track spending progress
- **Net Worth Dashboard** — Track savings, investments, assets, and debt over time
- **Portfolio Tracking** — Monitor stocks and crypto with optional price lookups
- **Privacy Mode** — Hide sensitive amounts with a single click
- **Data Export** — Export all your data anytime

## Privacy First

Your financial data never leaves your browser. Sors uses IndexedDB for local storage — no accounts, no cloud sync, no tracking. You own your data completely.

## Quick Start

### Option 1: Docker (Recommended for self-hosting)

```bash
docker run -d -p 3000:3000 --name sors ghcr.io/jos-ren/sors-finance:latest
```

Then open http://localhost:3000

### Option 2: Docker Compose

```bash
git clone https://github.com/jos-ren/sors-finance.git
cd sors-finance
docker compose up -d
```

### Option 3: Development

```bash
git clone https://github.com/jos-ren/sors-finance.git
cd sors-finance
npm install
npm run dev
```

Open http://localhost:3000

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
- **Database**: Dexie (IndexedDB wrapper)
- **UI**: shadcn/ui + Radix UI + Tailwind CSS
- **Charts**: Recharts
- **File Parsing**: PapaParse (CSV) + SheetJS (Excel)

## Contributing

Contributions are welcome! Whether it's:

- Adding support for new banks
- Bug fixes
- Feature improvements
- Documentation

Please open an issue first to discuss major changes.

## License

[MIT](LICENSE) — Free to use, modify, and distribute.
