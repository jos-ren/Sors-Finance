# Spike: Replace Goals with Projects

**Status:** Implemented (2026-10-15). Plan and progress: [`docs/plans/projects-plan.md`](../plans/projects-plan.md).

**Summary:** Goals do two jobs at once, saving up and explaining spending, and they do both badly. We are splitting them:

- A new **Projects** feature: a time-bound label on transactions (Japan trip, Moving out, New car). It sits on top of the monthly budget and does not replace categories.
- Savings goals become plain **saving categories**: Emergency Fund, TFSA, RRSP, Japan Trip Fund.

A transaction keeps its category (what it was) and can also carry a project (why it happened). This matches how Quicken, Lunch Money, Copilot, Banktivity and Firefly III handle trips and projects. Projects also connect to the monthly budget, so a project explains an unusual month instead of breaking it.

## The problem today

Goals are budget categories with `itemType = "goal"`, a `targetAmount` and a `targetDate` (`lib/db/schema.ts:111-113`). Progress comes from `lib/budget/goals-db.ts`:

- **contributed** = lifetime sum of the goal's monthly budget rows
- **spent** = lifetime net of transactions assigned to the goal category
- **available** = contributed − spent

This breaks down in practice.

- **A trip is not one category.** The Japan trip in `sors-test-data.json` is spread across Flights (Jan 2026, $1,684), Accommodation (Feb, $1,637) and Travel Spending plus uncategorized Tokyo purchases (Apr, $1,605). That is $4,926 across three months and four categories. To track it as a goal, every transaction would need to move into the "Japan Trip Fund" category and lose its real category.
- **The goal category holds the wrong transactions.** What actually lands in the goal category are the monthly $300 transfers ("EQ BANK TRAVEL FUND"), because the keyword targets them. Those are deposits into the fund, but the code counts them as spending from it. As a result, `available` is 0 for every goal in the test data.
- **It distorts the monthly view.** January shows as an over-budget month on the Home history strip because of a flight booked for April. Nothing on the page explains why.
- **The saving side is account-shaped.** Emergency Fund, TFSA and RRSP are transfers to an account. Their "target" is really an account balance, which Accounts already tracks.

### Other issues found along the way

- `components/features/budget/money-flow-sankey.tsx:94-99`: goal categories appear as child nodes, but their group total leaves goals out. The Savings & Goals group renders with too little value.
- `app/api/data/route.ts` does not write `targetDate` on import, so it is lost on a backup round-trip. The category dialog also never sets it.
- `app/api/budget/tree/route.ts:65-86` duplicates the goal math in `goals-db.ts`.

## What we want

> Things like a summer trip, a move out, or buying and upgrading a car. Not aligned with monthly budgeting. It exists in the time it does, and the transactions assigned to it explain spending in certain periods.

As requirements:

1. **Has its own time span.** It has a start, an optional end, and can cross month boundaries.
2. **Spans categories.** A flight is still Flights and dinner is still Restaurants.
3. **Explains periods.** "January was over budget because of $1,684 for the Japan trip."
4. **Shows a total.** "The Japan trip cost $4,926 against a $6,000 budget."
5. **Can be funded separately.** Big one-offs often come out of savings, not the monthly budget.

## Research: how other apps handle this

| App | Mechanism | Counts in budget? | Notes |
| --- | --- | --- | --- |
| Quicken | **Tags** across categories | Yes, the category still counts | "Categories describe what the money was for, tags describe who, which, or where." Explicitly recommended for projects and properties. |
| Lunch Money | **Tags**, many per transaction | Yes. Budget exclusion is a category property, not a tag property. | Examples given: trips ("Italy 2021"), events, renovations. Users have asked for tag budgets, which are not shipped. |
| Copilot Money | **Tags** | Yes | Help center: "Tag transactions with a specific tag to track the total spend on a specific project per month." |
| Banktivity | **Tags** | Yes | "Good for arbitrarily grouping transactions together, such as all your expenses from a particular vacation." |
| Firefly III | **Tags** plus **piggy banks** | Tags don't affect budgets | Piggy banks hold savings toward a target. Tags gather spending. These are two separate features. |
| YNAB | **Category group per trip**, or **#hashtags in memos** | Yes | The group approach loses the real category. The hashtag workaround exists because YNAB has no tags. |
| Monarch | **Goals 3.0**, linked to accounts | n/a | Splits "save up" from "pay down" goals and ties saving to account balances. Saving is account-shaped, not transaction-shaped. |

### Takeaways

- **Category = what, tag or project = why.** Every mature app keeps these orthogonal. None of them asks you to recategorize trip spending into a trip category.
- **Saving up and spending are separate features.** Firefly III has piggy banks plus tags, and Monarch has account-backed goals. Sors merges the two, which is the root of the current confusion.
- **Most apps stop at reporting.** Tags show totals but don't change the budget math, and the most common feature request is "let me budget by tag" or "exclude this tag from my budget". Sors goes further with the funding switch.
- **Multiple tags per transaction cause double counting** in reports (Quicken community). A single project per transaction avoids this.

## Decisions

| # | Question | Decision |
| --- | --- | --- |
| 1 | Name | **Projects** |
| 2 | Funding | **A switch on each project,** "Funded separately", on by default. It can be flipped any time. |
| 3 | Budget page category actuals | **Exclude** separately funded project spending, and add a "+$X in {project}" note on the row |
| 4 | Saved on Home | `income − bills − spending − separately funded project spending`, with a "$X to {project}" line. A negative Saved in a trip month is correct. |
| 5 | Project budget | **One total** per project. The by-category breakdown shows actuals only. |
| 6 | Saving categories and navigation | Saving categories keep an optional target and live in the Budget tree, with no nav entry. A project can link to a fund. **Projects replaces Goals** as a top-level nav item. |
| 7 | Assigning transactions | Date-window **suggestions** never auto-assign. **Project keywords** auto-assign on import, but only within the project's dates. Bulk "Add to project" and an edit dialog picker. |
| - | Category for project spending | Pick the category **as if the project didn't exist**, never Excluded. If nothing fits a big one-off, create a category in the matching group (Transportation › Vehicle Purchase). |
| - | Projects per transaction | **One.** |
| - | Old goals | `itemType: "goal"` becomes `"saving"`. The Goals page is replaced by Projects. |

## Model

### Data

```ts
// new table
projects: {
  id, uuid, userId,
  name,             // "Japan trip"
  color,            // chip colour
  startDate,        // required
  endDate,          // nullable: open-ended (car upgrades)
  budget,           // nullable: one total for the whole project
  fundedSeparately, // boolean, default true
  keywords,         // Keyword[], only matched inside the date window
  fundCategoryId,   // nullable link to a saving category ("Japan Trip Fund")
  notes, isArchived, createdAt, updatedAt
}

// transactions
projectId: integer nullable, references projects.id, on delete set null
```

- `projectId` sits alongside the one-FK rule and does not touch it. A transaction can be Flights + Japan trip, or Uncategorized + Japan trip.
- One project per transaction. There are no split transactions, so a transaction is wholly in or out.
- Status comes from the dates: **Upcoming**, **Active** or **Done**. Archive hides a project.
- The funding switch is read at query time. Nothing is stored per transaction, so flipping it recalculates every view.

### Choosing a category

Categories describe what a transaction was; the project describes why it happened. Pick the category as if the project didn't exist, then add the project.

| Transaction | Category (what) | Project (why) |
| --- | --- | --- |
| Dealer payment $20,000 | Transportation › Vehicle Purchase | New car |
| Winter tires $1,100 | Transportation › Car Maintenance | New car |
| Plates and registration $120 | Transportation › Licensing | New car |
| Dash cam $250 | Shopping › Electronics | New car |
| Monthly insurance | Transportation › Car Insurance (bill) | none |

- **Excluded** stays for money that isn't spending (transfers between your accounts, card payments). A $20,000 car is real spending.
- **Ongoing costs** (insurance, fuel, loan payments) stay out of the project. The project holds the one-off costs.
- **Financed purchases:** only the down payment is a one-off project transaction. Loan payments go to the loan bill category.
- **Paid from savings:** the savings-to-chequing transfer is Excluded. The purchase itself carries the project.
- **A $0 planned category** (Vehicle Purchase) is fine. With separate funding, the month is not marked over budget.

### Funding: how a project meets the monthly budget

The rule of thumb is about **where the money came from**:

- **Funded separately (on, the default):** paid from savings or a fund, or so big it would wreck the month.
- **Monthly budget (off):** paid out of the month's planned amounts. You just want the total in one place.

| Project | Cost | Funded separately? | Why |
| --- | --- | --- | --- |
| Japan trip | $4,926 over Jan–Apr | On | Paid from the Japan Trip Fund |
| Moving out | $3,200 | On | Paid from savings, far over any month's budget |
| New car | $20,000 | On | Not monthly money |
| Kitchen reno | $15,000 over 3 months | On | Same |
| Dog's surgery | $2,500, unplanned | On | The Emergency Fund covered it |
| Weekend in Niagara | $250 | Off | The Travel budget covers it |
| Christmas 2026 | $900 over Nov–Dec | Off | Gifts are budgeted monthly; the project shows the whole holiday |
| Friend's wedding | $800 | Either | Depends on whether the months absorbed it |

When a project is funded separately, the monthly views change like this:

| View | Change |
| --- | --- |
| Home, left to spend and pace | Excludes project spending |
| Home, history strip | The project part of each bar is drawn in a muted shade on top. January reads "on budget + $1,684 Japan trip" instead of red. |
| Home, Saved tile | `income − bills − spending − project spending`, with a "$1,605 to Japan trip" line. Saved and net worth now agree. |
| Budget page, category actuals | Excludes project spending, with a "+$X in Japan trip" note linking to the project |
| Trends | Project spending shows as its own series |

When the switch is off, project spending counts normally everywhere, and the project page still gives the total.

The classification seam becomes transaction-aware: `lib/budget/classify.ts` adds `classifyTransaction(category, project)`, returning `"bill" | "saving" | "spending" | "project"`. A separately funded project wins over the category's class, and everything still flows through one helper.

### Assigning transactions

1. **Bulk action in the transactions table:** "Add to project" and "Remove from project", plus a Project column and filter.
2. **Edit dialog:** a Project picker next to Category.
3. **Suggestions on the project page:** unassigned transactions inside the date window, with one click to add (or add all). They never auto-assign, so a Toronto coffee during the trip stays out.
4. **Project keywords:** "TOKYO", "JR EAST" or "U-HAUL" auto-assign on import, but only between the project's start and end dates. They run after normal categorization and never conflict with category keywords, because they set a different field.

### Navigation and pages

```
Home
Budget
Projects        ← replaces Goals
Transactions
Accounts ▸
```

- **Projects is top level** because it is the one feature that is not monthly. It is reached from Transactions as often as from Budget.
- **Projects page:** cards grouped by Active, Upcoming and Done, each showing name, dates, spent of budget and the funding badge.
- **Project detail:**
  - Total against budget.
  - **By category** (what) and **by month** (when).
  - The fund link, if set: "Set aside $3,600 in Japan Trip Fund, spent $4,926."
  - Transactions and suggestions.
- **Saving categories** have no nav entry. They stay in the Budget tree in a "Savings" group, and each row shows "$11,000 of $15,000". The category detail shows the full history and "Funding: Japan trip" if a project links to it.
- `/goals` and `/goals/[id]` redirect to `/projects`.
- **Naming overlap:** Accounts › Savings holds account balances, while the Savings budget group holds monthly contributions. Linking the two stays out of scope.

## What happens to current goals

- A data migration turns `itemType: "goal"` into `itemType: "saving"`.
  - Emergency Fund, TFSA, RRSP and Japan Trip Fund stay as categories.
  - Their transactions stay as transfers, so Home's saving math is unchanged.
- **Saving progress is lifetime contributions against the optional target.** "Spent" and "available" go away, which also removes the available-is-zero bug.
- **No automatic projects.** We can't tell which Flights transactions belong to which trip, so you create "Japan trip" once and use suggestions to fill it.
- **Test data** gets three projects:
  - Japan trip: Jan–Apr 2026, funded separately, linked to the fund.
  - Tofino weekend: Jun 2025, monthly.
  - Moving out: future dates with a budget, to show Upcoming.

## Worked example: Japan trip

| Month | Before | After ("Japan trip", funded separately) |
| --- | --- | --- |
| Jan 2026 | Flights $1,684, red bar, unexplained | Flights $0 in the budget with a "+$1,684 in Japan trip" note. Green bar plus a muted $1,684. |
| Feb 2026 | Accommodation $1,637, red | Same treatment |
| Apr 2026 | Travel Spending over, $508 of FamilyMart uncategorized in the inbox | $1,605 moves to the project. Saved shows "$1,605 to Japan trip". |
| Project page | n/a | $4,926 of $6,000 spent. Set aside $3,600 in the fund. Flights 34%, Accommodation 33%, Food and shopping 19%, Transit 14%. |

## Sources

- [Quicken: categories vs tags](https://info.quicken.com/sim/categories-vs-tags-what-s-the-difference)
- [Quicken: using tags to track projects and clients](https://info.quicken.com/sim/using-tags-to-track-projects-and-clients)
- [Quicken community: classes vs tags, double counting](https://community.quicken.com/discussion/comment/20063149)
- [Lunch Money: tags FAQ](https://support.lunchmoney.app/setup/tags/faq)
- [Lunch Money: categories and tags](https://lunchmoney.app/features/categories-tags)
- [Lunch Money: category properties (exclude from budget)](https://support.lunchmoney.app/setup/categories/category-properties)
- [Lunch Money feedback: budget by tag](https://feedback.lunchmoney.app/budget/p/budget-by-tag-merchant-account-etc)
- [Copilot Money: creative ways to use tags](https://help.copilot.money/en/articles/9554370-creative-ways-to-use-tags)
- [Banktivity: categories and tags](https://banktivity.com/help/v9/categories/about.php)
- [Firefly III documentation](https://docs.firefly-iii.org/explanation/firefly-iii/about/introduction/)
- [YNAB: organize your budget](https://www.ynab.com/blog/organize-your-budget)
- [YNAB: hashtags in memos](https://www.ynab.com/using-hashtags-in-your-transaction-memos-for-improved-budget-granularity-wi)
- [Monarch: Introducing Goals 3.0](https://help.monarch.com/hc/en-us/articles/44373110771860-Introducing-Goals-3-0)
- [Monarch: moving funds in and out of goals](https://help.monarch.com/hc/en-us/articles/46420712538260-Moving-Funds-In-and-Out-of-Goals)
