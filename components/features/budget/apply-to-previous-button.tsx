"use client";

import { useMemo, useState } from "react";
import { CopyPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyBudgetToMonths, getApplyTargets } from "@/hooks/use-budget";
import type { ApplyTarget } from "@/lib/db/client/budgets";

type Period = { year: number; month: number };

const key = ({ year, month }: Period) => year * 12 + month;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const monthLabel = ({ year, month }: Period) =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });

/**
 * Copies the viewed month's budget (planned amounts and income) into earlier
 * months you pick. Months that already have a budget are marked and replaced
 * when selected; empty months are selected by default.
 */
export function ApplyToPreviousButton({ year, month }: Period) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<ApplyTarget[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const source = monthLabel({ year, month });

  const openDialog = async () => {
    setLoading(true);
    try {
      const found = await getApplyTargets(year, month);
      if (found.length === 0) {
        toast.info("No earlier months to apply to");
        return;
      }
      setTargets(found);
      // Safe default: fill empty months, leave existing budgets alone until chosen.
      setSelected(new Set(found.filter((t) => !t.hasBudget).map(key)));
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to check earlier months");
    } finally {
      setLoading(false);
    }
  };

  // Newest first, grouped by year.
  const byYear = useMemo(() => {
    const years = new Map<number, ApplyTarget[]>();
    for (const t of [...targets].sort((a, b) => key(b) - key(a))) {
      years.set(t.year, [...(years.get(t.year) ?? []), t]);
    }
    return [...years.entries()];
  }, [targets]);

  const chosen = targets.filter((t) => selected.has(key(t)));
  const replacing = chosen.filter((t) => t.hasBudget).length;
  const allSelected = targets.length > 0 && chosen.length === targets.length;

  const toggle = (t: ApplyTarget, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key(t));
      else next.delete(key(t));
      return next;
    });

  const toggleYear = (items: ApplyTarget[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const t of items) {
        if (on) next.add(key(t));
        else next.delete(key(t));
      }
      return next;
    });

  const apply = async () => {
    setApplying(true);
    try {
      const { months } = await applyBudgetToMonths(year, month, chosen);
      toast.success(`Applied ${source} budget to ${months.length} ${months.length === 1 ? "month" : "months"}`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply budget");
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={openDialog} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />}
        Apply to earlier months
      </Button>

      <Dialog open={open} onOpenChange={(next) => !applying && setOpen(next)}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply {source} budget to earlier months</DialogTitle>
            <DialogDescription>
              Each month you pick gets a copy of the {source} planned amounts and income. Months that already have a
              budget are replaced.
            </DialogDescription>
          </DialogHeader>

          <label className="flex cursor-pointer items-center gap-2.5 border-b pb-3 text-sm font-medium">
            <Checkbox
              checked={allSelected ? true : chosen.length > 0 ? "indeterminate" : false}
              onCheckedChange={(on) => toggleYear(targets, on === true)}
            />
            Select all ({targets.length})
          </label>

          <div className="-mx-2 min-h-0 flex-1 space-y-4 overflow-y-auto px-2">
            {byYear.map(([y, items]) => {
              const yearChosen = items.filter((t) => selected.has(key(t))).length;
              return (
                <section key={y} className="space-y-1">
                  <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm font-semibold">
                    <Checkbox
                      checked={yearChosen === items.length ? true : yearChosen > 0 ? "indeterminate" : false}
                      onCheckedChange={(on) => toggleYear(items, on === true)}
                    />
                    {y}
                  </label>
                  {items.map((t) => (
                    <label
                      key={key(t)}
                      className="flex cursor-pointer items-center justify-between gap-2.5 rounded-md py-1 pl-7 pr-2 text-sm hover:bg-accent"
                    >
                      <span className="flex items-center gap-2.5">
                        <Checkbox checked={selected.has(key(t))} onCheckedChange={(on) => toggle(t, on === true)} />
                        {MONTH_NAMES[t.month]}
                      </span>
                      <span
                        className={
                          t.hasBudget
                            ? "text-xs text-amber-600 dark:text-amber-400"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {t.hasBudget ? "Has a budget" : "Empty"}
                      </span>
                    </label>
                  ))}
                </section>
              );
            })}
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {chosen.length === 0
                ? "Nothing selected"
                : replacing > 0
                  ? `${replacing} existing ${replacing === 1 ? "budget" : "budgets"} will be replaced`
                  : "No existing budgets will change"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={applying}>
                Cancel
              </Button>
              <Button onClick={apply} disabled={chosen.length === 0 || applying}>
                {applying && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Apply to {chosen.length} {chosen.length === 1 ? "month" : "months"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
