"use client";

import { useState } from "react";
import { CopyPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { applyBudgetToEmptyPreviousMonths } from "@/hooks/use-budget";

type Period = { year: number; month: number };

const monthLabel = ({ year, month }: Period) =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });

/**
 * Copies the viewed month's budget into every earlier month that has
 * transactions but no budget yet. Asks first, listing how many months change.
 */
export function ApplyToPreviousButton({ year, month }: Period) {
  const [busy, setBusy] = useState(false);
  const [months, setMonths] = useState<Period[] | null>(null);

  const source = monthLabel({ year, month });

  const preview = async () => {
    setBusy(true);
    try {
      const { months: targets } = await applyBudgetToEmptyPreviousMonths(year, month, true);
      if (targets.length === 0) {
        toast.info("No earlier months need a budget");
      } else {
        setMonths(targets);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to check earlier months");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setMonths(null);
    setBusy(true);
    try {
      const { months: targets } = await applyBudgetToEmptyPreviousMonths(year, month);
      toast.success(`Applied ${source} budget to ${targets.length} earlier ${targets.length === 1 ? "month" : "months"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply budget");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={preview} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />}
        Apply to earlier months
      </Button>
      <ConfirmDialog
        open={months !== null}
        onOpenChange={(open) => !open && setMonths(null)}
        title={`Apply ${source} budget to earlier months?`}
        description={
          months
            ? `${months.length} earlier ${months.length === 1 ? "month has" : "months have"} transactions but no budget (${monthLabel(months[0])}${
                months.length > 1 ? ` to ${monthLabel(months[months.length - 1])}` : ""
              }). Each gets a copy of the ${source} planned amounts and income. Months that already have a budget are not changed.`
            : ""
        }
        confirmLabel="Apply"
        onConfirm={apply}
      />
    </>
  );
}
