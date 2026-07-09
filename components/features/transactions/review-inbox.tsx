"use client";

import { useMemo, useState } from "react";
import { CircleCheck, AlertTriangle, Circle, Check, Loader2, Inbox, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  BudgetItemPicker,
  fromPickerValue,
  toPickerValue,
  type PickerValue,
} from "@/components/features/budget/budget-item-picker";
import {
  useTransactions,
  useCategories,
  updateTransaction,
  addKeywordToCategory,
  invalidateTransactions,
} from "@/hooks";
import { useBudgetHierarchy, addKeywordToSubcategory } from "@/hooks/use-budget";
import { matchGlobalDictionary } from "@/lib/categories/global-dictionary";
import { matchesKeyword } from "@/lib/categories/keyword";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";
import type { DbTransaction, Keyword, KeywordMatchMode } from "@/lib/db/types";

const MATCH_MODE_LABELS: Record<KeywordMatchMode, string> = {
  contains: "contains",
  startsWith: "starts with",
  exact: "exactly matches",
};

type RowKind = "suggestion" | "conflict" | "uncategorized";

function rowKind(t: DbTransaction): RowKind {
  if (t.conflictCategories && t.conflictCategories.length > 0) return "conflict";
  if (t.categoryId != null || t.budgetItemId != null) return "suggestion";
  return "uncategorized";
}

export function ReviewInbox() {
  const transactions = useTransactions();
  const categories = useCategories();
  const hierarchy = useBudgetHierarchy(false);
  const { formatAmount } = usePrivacy();
  const userCurrency = useCurrency();

  // Local UI state
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [overrides, setOverrides] = useState<Map<number, PickerValue>>(new Map()); // suggestion FK changes
  const [picks, setPicks] = useState<Map<number, PickerValue>>(new Map()); // uncategorized: chosen but not committed
  const [ruleText, setRuleText] = useState<Map<number, string>>(new Map());
  const [ruleMode, setRuleMode] = useState<Map<number, KeywordMatchMode>>(new Map());
  const [bulkApply, setBulkApply] = useState<Map<number, boolean>>(new Map()); // default on when siblings exist

  const pending = useMemo(
    () => (transactions ?? []).filter((t) => t.reviewStatus === "pending"),
    [transactions]
  );

  // id → { uuid, name, keywords } lookups for resolving names + keyword promotion.
  const subById = useMemo(() => {
    const m = new Map<number, { uuid: string; name: string; keywords: Keyword[] }>();
    for (const s of hierarchy?.subcategories ?? []) {
      if (s.id != null) m.set(s.id, { uuid: s.uuid, name: s.name, keywords: s.keywords ?? [] });
    }
    return m;
  }, [hierarchy]);

  const catById = useMemo(() => {
    const m = new Map<number, { uuid: string; name: string; keywords: Keyword[] }>();
    for (const c of categories ?? []) {
      if (c.id != null) m.set(c.id, { uuid: c.uuid, name: c.name, keywords: c.keywords ?? [] });
    }
    return m;
  }, [categories]);

  const dictionaryTargets = useMemo(() => {
    const targets: { uuid: string; name: string }[] = [];
    for (const s of hierarchy?.subcategories ?? []) targets.push({ uuid: s.uuid, name: s.name });
    for (const c of categories ?? []) targets.push({ uuid: c.uuid, name: c.name });
    return targets;
  }, [hierarchy, categories]);

  if (pending.length === 0) return null;

  const categoryName = (t: DbTransaction): string => {
    if (t.budgetItemId != null) return subById.get(t.budgetItemId)?.name ?? "Category";
    if (t.categoryId != null) return catById.get(t.categoryId)?.name ?? "Category";
    return "Category";
  };

  const setBusyFor = (id: number, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /** Append a keyword to the chosen category (budget item or system) + refresh matches. */
  const promoteKeyword = async (value: PickerValue, pattern: string, mode: KeywordMatchMode = "contains") => {
    if (!value || !pattern.trim()) return;
    if (value.kind === "item") {
      const sub = subById.get(value.id);
      await addKeywordToSubcategory(value.id, pattern.trim(), sub?.keywords ?? [], mode);
    } else {
      await addKeywordToCategory(value.id, pattern.trim(), mode);
    }
    invalidateTransactions();
  };

  /** Approve a global suggestion: promote the merchant pattern to a keyword, then clear it. */
  const approveSuggestion = async (t: DbTransaction) => {
    if (t.id == null || busy.has(t.id)) return;
    setBusyFor(t.id, true);
    try {
      const chosen = overrides.get(t.id) ?? toPickerValue(t.categoryId, t.budgetItemId);
      const match = matchGlobalDictionary(t.matchField, dictionaryTargets);
      if (match) await promoteKeyword(chosen, match.pattern, match.mode);
      await updateTransaction(t.id, {
        ...fromPickerValue(chosen),
        reviewStatus: "reviewed",
        conflictCategories: null,
      });
      setOverrides((prev) => {
        const next = new Map(prev);
        next.delete(t.id!);
        return next;
      });
    } catch {
      toast.error("Failed to approve transaction");
    } finally {
      setBusyFor(t.id, false);
    }
  };

  const approveAll = async () => {
    const suggestions = pending.filter((t) => rowKind(t) === "suggestion");
    for (const t of suggestions) {
      // eslint-disable-next-line no-await-in-loop
      await approveSuggestion(t);
    }
  };

  /** Conflict resolution: picking a category immediately approves the row. */
  const resolveConflict = async (t: DbTransaction, value: PickerValue) => {
    if (t.id == null || busy.has(t.id) || !value) return;
    setBusyFor(t.id, true);
    try {
      await updateTransaction(t.id, {
        ...fromPickerValue(value),
        reviewStatus: "reviewed",
        conflictCategories: null,
      });
    } catch {
      toast.error("Failed to categorize transaction");
    } finally {
      setBusyFor(t.id, false);
    }
  };

  /** Pending, uncategorized rows whose matchField satisfies `pattern` under `mode` (excluding `exceptId`). */
  const matchingSiblings = (pattern: string, mode: KeywordMatchMode, exceptId: number): DbTransaction[] => {
    const p = pattern.trim();
    if (!p) return [];
    const keyword: Keyword = { text: p, mode };
    return pending.filter(
      (o) =>
        o.id != null &&
        o.id !== exceptId &&
        o.categoryId == null &&
        o.budgetItemId == null &&
        (!o.conflictCategories || o.conflictCategories.length === 0) &&
        matchesKeyword(o.matchField, keyword)
    );
  };

  const clearRowState = (id: number) => {
    setPicks((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setRuleText((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setRuleMode((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setBulkApply((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  /**
   * Commit an uncategorized row's chosen category. Optionally saves the merchant
   * as a keyword rule, and optionally applies the same category to matching
   * unreviewed siblings.
   */
  const commitUncategorized = async (t: DbTransaction, saveRule: boolean) => {
    if (t.id == null || busy.has(t.id)) return;
    const value = picks.get(t.id);
    if (!value) return;
    const pattern = (ruleText.get(t.id) ?? t.matchField).trim();
    const mode = ruleMode.get(t.id) ?? "contains";
    const doBulk = (bulkApply.get(t.id) ?? true) && pattern.length > 0;
    const siblings = doBulk ? matchingSiblings(pattern, mode, t.id) : [];

    setBusyFor(t.id, true);
    try {
      if (saveRule && pattern) await promoteKeyword(value, pattern, mode);

      // Apply the category to matching siblings first (approve them too).
      for (const sib of siblings) {
        // eslint-disable-next-line no-await-in-loop
        await updateTransaction(sib.id!, {
          ...fromPickerValue(value),
          reviewStatus: "reviewed",
          conflictCategories: null,
        });
      }

      await updateTransaction(t.id, {
        ...fromPickerValue(value),
        reviewStatus: "reviewed",
        conflictCategories: null,
      });

      if (siblings.length > 0) {
        toast.success(`Categorized ${siblings.length + 1} transactions`);
      }
      clearRowState(t.id);
    } catch {
      toast.error("Failed to categorize transaction");
    } finally {
      setBusyFor(t.id, false);
    }
  };

  const suggestionCount = pending.filter((t) => rowKind(t) === "suggestion").length;

  return (
    <section className="rounded-lg border border-amber-300/60 dark:border-amber-700/50 bg-amber-50/40 dark:bg-amber-950/10">
      <div className="flex items-center justify-between gap-3 border-b border-amber-300/40 dark:border-amber-700/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h2 className="text-sm font-semibold">Needs Review</h2>
          <Badge variant="secondary" className="bg-amber-200/70 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">
            {pending.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {suggestionCount > 0 && (
            <Button size="sm" onClick={approveAll} disabled={busy.size > 0}>
              <Check className="h-4 w-4 mr-1.5" />
              Approve All ({suggestionCount})
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand Needs Review" : "Collapse Needs Review"}
            aria-expanded={!collapsed}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")} />
          </Button>
        </div>
      </div>

      {!collapsed && (
      <div className="divide-y divide-border/60">
        {pending.map((t) => {
          const kind = rowKind(t);
          const isBusy = t.id != null && busy.has(t.id);
          const netClass = t.amountIn > 0 ? "text-emerald-600 dark:text-emerald-400" : "";
          const amountStr =
            t.amountIn > 0
              ? `+${formatAmount(t.amountIn, userCurrency)}`
              : `-${formatAmount(t.amountOut, userCurrency)}`;

          const pickedValue = t.id != null ? picks.get(t.id) : undefined;

          return (
            <div key={t.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Status icon */}
                <div className="shrink-0">
                  {kind === "suggestion" && <CircleCheck className="h-5 w-5 text-emerald-500" />}
                  {kind === "conflict" && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                  {kind === "uncategorized" && <Circle className="h-5 w-5 text-muted-foreground/50" />}
                </div>

                {/* Description + amount */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.description}</p>
                  <p className={`text-xs ${netClass || "text-muted-foreground"}`}>{amountStr}</p>
                </div>

                {/* Action area */}
                <div className="flex shrink-0 items-center gap-2">
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : kind === "suggestion" ? (
                    <>
                      <BudgetItemPicker
                        variant="badge"
                        allowCreate
                        value={t.id != null ? overrides.get(t.id) ?? toPickerValue(t.categoryId, t.budgetItemId) : null}
                        onChange={(v) =>
                          setOverrides((prev) => {
                            const next = new Map(prev);
                            if (t.id != null) next.set(t.id, v);
                            return next;
                          })
                        }
                        placeholder={categoryName(t)}
                      />
                      <Button size="sm" onClick={() => approveSuggestion(t)}>
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </>
                  ) : kind === "conflict" ? (
                    <BudgetItemPicker
                      variant="badge"
                      allowCreate
                      value={null}
                      onChange={(v) => resolveConflict(t, v)}
                      placeholder="Select Category (Multiple Matches)"
                    />
                  ) : (
                    // uncategorized — hide the picker once a category is chosen (composer takes over)
                    !pickedValue && (
                      <BudgetItemPicker
                        variant="badge"
                        allowCreate
                        value={null}
                        onChange={(v) =>
                          setPicks((prev) => {
                            const next = new Map(prev);
                            if (t.id != null) next.set(t.id, v);
                            return next;
                          })
                        }
                        placeholder="Select Category"
                      />
                    )
                  )}
                </div>
              </div>

              {/* Rule composer — appears once a category is chosen for an uncategorized row */}
              {kind === "uncategorized" && pickedValue && t.id != null && !isBusy && (() => {
                const rt = ruleText.get(t.id) ?? t.matchField;
                const rm = ruleMode.get(t.id) ?? "contains";
                const bulk = bulkApply.get(t.id) ?? true;
                const siblingCount = matchingSiblings(rt, rm, t.id).length;
                const canSaveRule = rt.trim().length > 0;
                return (
                  <div className="mt-2 flex flex-col gap-4 rounded-lg border bg-background/60 px-6 py-5">
                    {/* Tier 1 — overline context */}
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Create Rule
                    </span>

                    {/* Tier 2 — the core logic sentence */}
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-2 text-sm leading-7 text-muted-foreground">
                      <span>If description</span>
                      <Select
                        value={rm}
                        onValueChange={(v) =>
                          setRuleMode((prev) => {
                            const next = new Map(prev);
                            next.set(t.id!, v as KeywordMatchMode);
                            return next;
                          })
                        }
                      >
                        <SelectTrigger size="sm" className="h-7 w-auto border-0 border-b border-dashed border-muted-foreground/40 bg-transparent px-0.5 text-sm font-semibold text-foreground shadow-none hover:border-primary focus:border-solid focus:border-primary data-[state=open]:border-solid">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(MATCH_MODE_LABELS) as KeywordMatchMode[]).map((m) => (
                            <SelectItem key={m} value={m}>
                              {MATCH_MODE_LABELS[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input
                        value={rt}
                        onChange={(e) =>
                          setRuleText((prev) => {
                            const next = new Map(prev);
                            next.set(t.id!, e.target.value);
                            return next;
                          })
                        }
                        className="min-w-[6rem] max-w-full border-0 border-b border-dashed border-muted-foreground/40 bg-transparent px-0.5 text-sm font-semibold text-foreground outline-none transition-colors [field-sizing:content] hover:border-primary focus:border-solid focus:border-primary"
                      />
                      <span>, categorize as</span>
                      <BudgetItemPicker
                        variant="inline"
                        allowCreate
                        value={pickedValue}
                        onChange={(v) =>
                          setPicks((prev) => {
                            const next = new Map(prev);
                            next.set(t.id!, v);
                            return next;
                          })
                        }
                        placeholder="Select Category"
                      />
                    </div>

                    {/* Tier 3 — secondary micro-copy */}
                    {siblingCount > 0 && (
                      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                        <Checkbox
                          checked={bulk}
                          onCheckedChange={(c) =>
                            setBulkApply((prev) => {
                              const next = new Map(prev);
                              next.set(t.id!, c === true);
                              return next;
                            })
                          }
                        />
                        Also apply to {siblingCount} other unreviewed transaction{siblingCount !== 1 ? "s" : ""} with matching descriptions
                      </label>
                    )}

                    {/* Actions — balanced to the bottom-right, cancel kept subtle on the left */}
                    <div className="flex items-center justify-between border-t pt-4">
                      <button
                        type="button"
                        className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => clearRowState(t.id!)}
                      >
                        Cancel
                      </button>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => commitUncategorized(t, false)}>
                          Approve without rule
                        </Button>
                        <Button size="sm" onClick={() => commitUncategorized(t, true)} disabled={!canSaveRule}>
                          Save Rule &amp; Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}
