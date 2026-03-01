# Bank Parsers

This directory contains the extensible bank parser system for Sors Finance.

## Architecture

```
lib/parsers/
├── index.ts       # Registry, detection, and parsing API
├── types.ts       # TypeScript interfaces
├── utils.ts       # Shared parsing utilities
├── README.md      # This file
└── banks/         # Individual bank parsers
    ├── custom.ts     # Custom import with user-defined column mapping
    └── _template.ts  # Template for new banks
```

## Adding a New Bank Parser

### 1. Create a new parser file

Copy `banks/_template.ts` to `banks/yourbank.ts`:

```bash
cp lib/parsers/banks/_template.ts lib/parsers/banks/yourbank.ts
```

### 2. Implement the BankParser interface

Each parser must implement three methods:

- **`detect(file, rows)`** - Determine if a file matches this bank's format
- **`validate(file, rows)`** - Check for errors before parsing
- **`parse(file, rows)`** - Extract transactions from the file

### 3. Fill in the metadata

```typescript
meta: {
  id: "YOURBANK",           // Unique identifier (stored in database)
  name: "Your Bank Name",   // Display name in UI
  country: "CA",            // ISO 3166-1 alpha-2 country code
  supportedExtensions: [".csv", ".xlsx"],
  formatDescription: "Brief description of expected format",
  exportInstructionsUrl: "https://...",  // Optional
}
```

### 4. Register your parser

Add your parser to `lib/parsers/index.ts`:

```typescript
import { yourbankParser } from "./banks/yourbank";

const PARSERS: BankParser[] = [
  customParser,
  yourbankParser,  // Add here
];
```

### 5. Add filename pattern (optional)

If your bank's files have a predictable filename, add a pattern:

```typescript
const FILENAME_PATTERNS: FilenamePattern[] = [
  { bankId: "YOURBANK", pattern: /yourbank/i },
];
```

### 6. Add logo (optional)

Add your bank's logo to `public/logos/yourbank.png` and update `FileUpload.tsx`:

```typescript
const BANK_LOGOS: Record<string, string> = {
  YOURBANK: "/logos/yourbank.png",
};
```

## Utility Functions

The `utils.ts` file provides common parsing helpers:

### Date Parsers

```typescript
import { parseDateMDY, parseDateDMY, parseDateISO, parseDateDMonY, parseDateMonDY } from "../utils";

parseDateMDY("12/25/2025")     // MM/DD/YYYY
parseDateDMY("25/12/2025")     // DD/MM/YYYY
parseDateISO("2025-12-25")     // YYYY-MM-DD
parseDateDMonY("25 Dec 2025")  // DD Mon YYYY
parseDateMonDY("Dec 25, 2025") // Mon DD, YYYY
```

### Amount Parser

```typescript
import { parseAmount } from "../utils";

parseAmount("$1,234.56")  // 1234.56
parseAmount("-€500,00")   // -500 (handles European format)
parseAmount("(100.00)")   // -100 (handles negative in parentheses)
```

### Row Utilities

```typescript
import { getCellString, isEmptyRow, readFileToRows } from "../utils";

getCellString(row, 0)     // Safely get cell as string
isEmptyRow(row)           // Check if row is empty
readFileToRows(file)      // Read CSV/Excel to array of arrays
```

## Testing Your Parser

1. Export a sample file from your bank
2. Test detection: Does it correctly identify the bank?
3. Test validation: Does it catch format errors?
4. Test parsing: Are all transactions extracted correctly?

## File Format Documentation

When adding a new bank, document the export format:

- File type (CSV, Excel)
- Headers (present/absent, which row)
- Column layout (what data is in each column)
- Date format
- Amount format (separate in/out columns vs single signed column)
- Any special cases (payment rows, pending transactions)

See the existing parsers for examples.
