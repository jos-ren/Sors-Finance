# Budget System Strategy

## What We're Building

A **zero-based budgeting system** with a three-level hierarchy that separates permanent organization from temporary spending/saving goals.

Zero-based budgeting means: every dollar of income is assigned a job. The goal each month is for **Income − Total Budgeted = $0**.

---

## The Three-Level Hierarchy

```
Category
  └── Subcategory
        └── Budget Item  ← transactions are assigned here
```

| Level | Purpose | Changes how often? |
|---|---|---|
| **Category** | Broad grouping (Housing, Food, Bills, Goals, Savings) | Rarely / never |
| **Subcategory** | Organizes similar items within a category (Groceries, Subscriptions, Travel) | Occasionally |
| **Budget Item** | The specific thing you budget money for each month | Frequently |

**Only Budget Items get a dollar amount each month.** Categories and Subcategories display totals that roll up automatically from their Budget Items.

---

## Example Structure

```
Housing
  ├── Rent
  │     └── Apartment Rent
  └── Utilities
        ├── Hydro
        └── Internet

Food
  ├── Groceries
  │     └── Groceries
  └── Dining Out
        ├── Restaurants
        └── Coffee

Bills
  └── Subscriptions
        ├── Netflix
        ├── Spotify
        └── ChatGPT

Transportation
  └── Vehicle
        ├── Fuel
        └── Car Insurance

Savings
  ├── Emergency Fund
  │     └── Emergency Fund
  └── Retirement
        ├── TFSA
        └── RRSP

Goals
  ├── Travel
  │     └── Japan Trip
  ├── Electronics
  │     └── Camera
  └── Home
        └── Down Payment

Flexible Spending
  ├── Personal
  │     └── Personal Spending
  ├── Fun
  │     └── Fun Money
  ├── Miscellaneous
  │     └── Misc Purchases
  └── Buffer
        └── Unexpected Expenses
```

---

## How Monthly Budgeting Works

The user sets a **Planned** amount on each **Budget Item** for the month. The app then:

1. Sums Budget Items → Subcategory total
2. Sums Subcategories → Category total
3. Shows **Income − All Budgeted = Remaining to Assign**

**Example budget view:**

```
Food
  Groceries ........... $500    actual: $487    ✅
  Dining Out .......... $150    actual: $203    ⚠️
  Total Food .......... $650    actual: $690

Goals
  Travel .............. $300    actual: $300    ✅
  Electronics ......... $150    actual: $0      💤
  Total Goals ......... $450    actual: $300

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Income:        $5,000
Total Budgeted:      $4,800
Remaining:           $200  ← should be $0 in zero-based
```

---

## Transaction Assignment

**Transactions are assigned to Budget Items** (the leaf level). This replaces the current flat category system.

### Auto-categorization (keywords)
- Keywords live on **Budget Items**, not on Categories or Subcategories
- The existing keyword matching logic (case-insensitive, partial match) stays the same — it just runs against Budget Items instead of the old flat categories
- Example: "Groceries" Budget Item has keywords `["WHOLE FOODS", "TRADER JOE", "COSTCO"]`

### Manual assignment
- Users can manually assign any transaction to any Budget Item
- The conflict resolver and uncategorized flows work the same way as today

---

## System Categories (Outside the Hierarchy)

Three special flat categories exist **outside** the 3-level hierarchy and cannot be deleted:

| Name | Purpose |
|---|---|
| **Income** | Payroll, direct deposits, transfers in |
| **Excluded** | Transactions to ignore (transfers between own accounts, etc.) |
| **Uncategorized** | Fallback for transactions with no match |

These don't participate in budgeting. Income is tracked separately as the total to allocate against. Excluded and Uncategorized are operational buckets, not budget lines.

---

## Flexible Spending: A Catch-All Category

**Flexible Spending** is a first-class category for money that doesn't fit neatly into fixed spending areas. It's intentional, not a junk drawer — every dollar in it is still assigned a job.

Typical subcategories:

| Subcategory | Budget Item | Purpose |
|---|---|---|
| Personal | Personal Spending | Clothing, haircuts, personal care |
| Fun | Fun Money | Entertainment, hobbies, eating out on a whim |
| Miscellaneous | Misc Purchases | One-offs that don't fit anywhere else |
| Buffer | Unexpected Expenses | Small surprises that would otherwise blow other categories |

The Buffer item in particular is important for zero-based budgeting — it absorbs small unexpected costs without requiring the user to re-budget other categories mid-month.

---

## Goals: Temporary Budget Items

The **Goals** category is designed to hold temporary saving targets that change over time.

- Goals are just Budget Items inside a Goal Subcategory
- When a goal is complete (trip taken, item purchased), the Budget Item is **archived** (marked inactive) — it disappears from the active budget but its history is preserved
- The Category and Subcategory remain, ready for the next goal

```
Goals
  └── Travel
        ├── Japan Trip       ← active, saving toward this
        └── Europe Trip 2024 ← archived, completed
```

---

## What Changes vs. Today

| What | Today | After |
|---|---|---|
| Transaction classification | Flat `categories` table | Budget Items (leaf of hierarchy) |
| Keywords | On categories | On Budget Items |
| Budget amounts | `budgets` table → `categoryId` | `budgets` table → `budgetItemId` |
| Budget page | Shows flat category list with amounts | Shows collapsible 3-level tree with roll-up totals |
| Categories page | Manage flat list of categories | Manage the full 3-level hierarchy |

---

## Database Schema Changes

Three new tables replace the current flat `categories` approach:

### `budget_groups` (replaces most of `categories`)
The top-level Category. Stores name, order, user.

### `budget_subcategories`
Belongs to a `budget_group`. Stores name, order, user.

### `budget_items`
Belongs to a `budget_subcategory`. This is what users budget and what transactions attach to.
- Stores: name, keywords, order, isActive (for archiving goals), user
- Replaces the old `categories.id` that `transactions.categoryId` pointed to

### `budgets` (updated)
Currently links `categoryId → year/month/amount`.
Updated to link `budgetItemId → year/month/amount`.

### `transactions` (updated)
Currently: `categoryId` → flat categories.
Updated: `budgetItemId` → budget items.

### `categories` (kept, reduced)
Kept only for the three system categories: **Income**, **Excluded**, **Uncategorized**.
Transactions that are income/excluded/uncategorized still use `categoryId` pointing to this table.

> **Migration:** Existing user categories become Budget Items. Each existing category maps to a Budget Item inside a new auto-created Subcategory and Category with the same name. Users can then reorganize the hierarchy after migration.

---

## UI Changes

### Budget Page
- Replace flat list with a **collapsible tree**: Category → Subcategory → Budget Items
- Each Budget Item has an editable Planned amount and shows Actual (sum of assigned transactions)
- Subcategory and Category rows show rolled-up totals (read-only)
- Top of page shows: **Income | Total Budgeted | Remaining to Assign**
- Budget Items with `isActive = false` are hidden (archived goals)

### Categories / Hierarchy Management Page
- Tree view to add/edit/delete/reorder Groups, Subcategories, and Budget Items
- Keyword management moves to Budget Items
- Archive button on Budget Items (for goals)

### Transactions Page
- Filter/group by Budget Item, Subcategory, or Category
- Assignment UI uses the 3-level hierarchy picker instead of a flat dropdown

---

## What Stays the Same

- Transaction import flow (upload → parse → resolve → save)
- Bank parser system
- Auto-categorization logic (keyword matching) — just targets Budget Items
- Conflict resolver and uncategorized assignment UI (with updated picker)
- All portfolio/snapshot/Plaid functionality
- Settings page

---

## Default Budget for New Users

When a new user registers, the app seeds a complete example budget so they aren't greeted with a blank slate. This serves two purposes: it demonstrates how the hierarchy works, and it gives them a realistic starting point to edit rather than build from scratch.

The default seed uses a **$5,500/month income** example and includes all standard categories:

```
Housing ............................................. $1,720
├── Rent
│     └── Apartment Rent ...................... $1,500
└── Utilities
      ├── Hydro ................................. $70
      ├── Internet .............................. $80
      └── Tenant Insurance ...................... $70

Food ................................................ $700
├── Groceries
│     └── Groceries ............................ $500
├── Dining Out
│     └── Restaurants ......................... $150
└── Coffee
      └── Coffee Shops ......................... $50

Transportation ...................................... $480
├── Vehicle
│     ├── Fuel ................................ $180
│     ├── Car Insurance ....................... $170
│     └── Maintenance ......................... $80
└── Transit
      └── Public Transit ....................... $50

Bills ............................................... $240
├── Phone
│     └── Cell Phone ........................... $80
├── Subscriptions
│     ├── Netflix .............................. $20
│     ├── Spotify .............................. $15
│     ├── ChatGPT .............................. $30
│     └── iCloud ............................... $15
└── Banking
      └── Credit Card Fee ...................... $80

Health .............................................. $100
└── Fitness
      ├── Gym Membership ....................... $60
      └── Supplements .......................... $40

Pets ................................................ $120
├── Dog
│     ├── Dog Food ............................. $70
│     └── Toys & Treats ........................ $20
└── Vet
      └── Vet & Medication ..................... $30

Savings ........................................... $1,100
├── Emergency Fund
│     └── Emergency Fund ...................... $300
├── Retirement
│     ├── TFSA ................................ $300
│     └── RRSP ................................ $200
└── Investing
      └── Index Funds ......................... $300

Goals ............................................... $560
├── Travel
│     └── Japan Trip .......................... $250
├── Electronics
│     └── Mirrorless Camera ................... $150
└── Home
      └── New Desk ............................ $160

Flexible Spending ................................... $480
├── Personal
│     └── Personal Spending ................... $200
├── Fun
│     └── Fun Money ........................... $150
├── Miscellaneous
│     └── Misc Purchases ...................... $80
└── Buffer
      └── Unexpected Expenses ................. $50

────────────────────────────────────────────────────────────

TOTAL BUDGETED .................................... $5,500
REMAINING TO ASSIGN ............................... $0
```

The seed budget also includes default **keywords** on each Budget Item so auto-categorization works immediately out of the box (e.g., "Groceries" matches `WHOLE FOODS`, `COSTCO`, etc.).

Users are expected to delete, rename, and reorganize this structure to match their own lives. The example just makes the first session useful rather than intimidating.

### Income

Income is entirely transaction-driven. The system does not rely on a static monthly income value—instead, it computes income from imported bank transactions categorized as Income (e.g. payroll, bonuses, tax refunds, reimbursements).

Core Rule
Available to Assign = Total Income Transactions − Total Budgeted Amount
Expected vs Actual Income
Expected Income: user-defined planning value (optional, for reference only)
Actual Income: sum of all imported income transactions
Budgeted Income: total amount already assigned across budget items

Only Actual Income drives budgeting availability.

Surplus Income (Positive Difference)

If actual income exceeds budgeted income:

System shows “Available to Assign”
User must allocate funds to budget items (Savings, Goals, Spending, etc.)
Budget remains zero-based after assignment

Example:

Actual: $6,140
Budgeted: $5,500
Available: $640 → must be assigned
Income Shortfall (Negative Difference)

If actual income is less than budgeted:

System shows “Over-Budgeted Income”
User must reduce existing budget allocations until balanced

Example:

Actual: $5,500
Budgeted: $5,800
Adjustment required: -$300
Key Design Principle

Income is not “entered”—it is observed from transactions.
Budgeting is always reconciled against reality, not assumptions.

This keeps the system:

Fully zero-based
Reactive to real financial changes
Compatible with irregular income (bonuses, refunds, side income)

---

## Summary

The core idea is simple: **Budget Items are the new categories.** The two levels above them (Subcategory and Category) are purely organizational — they never touch transactions directly and only exist to make the budget readable and reportable at a high level. This gives zero-based budgeting a clean home while keeping the transaction import system largely intact.