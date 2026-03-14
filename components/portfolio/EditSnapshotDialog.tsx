"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePortfolioSnapshot, DbPortfolioSnapshot } from "@/lib/hooks/useDatabase";
import { useCurrency, useTimezone } from "@/lib/settings-context";
import { usePrivacy } from "@/lib/privacy-context";
import { formatDateTime } from "@/lib/formatters";
import { toast } from "sonner";

interface EditSnapshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: DbPortfolioSnapshot;
}

// Format number to 2 decimal places
function formatValue(value: number): string {
  return value.toFixed(2);
}

// Parse and validate numeric input
function parseNumericInput(value: string): string {
  // Remove non-numeric characters except decimal point
  const cleaned = value.replace(/[^0-9.]/g, "");
  // Only allow one decimal point
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    return parts[0] + "." + parts.slice(1).join("");
  }
  return cleaned;
}

export function EditSnapshotDialog({ open, onOpenChange, snapshot }: EditSnapshotDialogProps) {
  const [savings, setSavings] = useState("");
  const [investments, setInvestments] = useState("");
  const [assets, setAssets] = useState("");
  const [debt, setDebt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userCurrency = useCurrency();
  const userTimezone = useTimezone();
  const { formatAmount } = usePrivacy();

  // Reset form when snapshot changes
  useEffect(() => {
    setSavings(formatValue(snapshot.totalSavings));
    setInvestments(formatValue(snapshot.totalInvestments));
    setAssets(formatValue(snapshot.totalAssets));
    setDebt(formatValue(snapshot.totalDebt));
  }, [snapshot]);

  // Handle input change with validation
  const handleChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(parseNumericInput(e.target.value));
  };

  // Format on blur
  const handleBlur = (setter: (value: string) => void, value: string) => () => {
    const num = parseFloat(value) || 0;
    setter(formatValue(num));
  };

  // Calculate net worth preview
  const netWorth =
    (parseFloat(savings) || 0) +
    (parseFloat(investments) || 0) +
    (parseFloat(assets) || 0) -
    (parseFloat(debt) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updatePortfolioSnapshot(snapshot.id!, {
        totalSavings: parseFloat(savings) || 0,
        totalInvestments: parseFloat(investments) || 0,
        totalAssets: parseFloat(assets) || 0,
        totalDebt: parseFloat(debt) || 0,
      });

      toast.success("Snapshot updated");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update snapshot");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Snapshot</DialogTitle>
          <DialogDescription>
            {formatDateTime(snapshot.date, userTimezone)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="savings" className="text-emerald-500">
                Savings
              </Label>
              <Input
                id="savings"
                type="text"
                inputMode="decimal"
                value={savings}
                onChange={handleChange(setSavings)}
                onBlur={handleBlur(setSavings, savings)}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="investments" className="text-blue-500">
                Investments
              </Label>
              <Input
                id="investments"
                type="text"
                inputMode="decimal"
                value={investments}
                onChange={handleChange(setInvestments)}
                onBlur={handleBlur(setInvestments, investments)}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assets" className="text-amber-500">
                Assets
              </Label>
              <Input
                id="assets"
                type="text"
                inputMode="decimal"
                value={assets}
                onChange={handleChange(setAssets)}
                onBlur={handleBlur(setAssets, assets)}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="debt" className="text-red-500">
                Debt
              </Label>
              <Input
                id="debt"
                type="text"
                inputMode="decimal"
                value={debt}
                onChange={handleChange(setDebt)}
                onBlur={handleBlur(setDebt, debt)}
                placeholder="0.00"
              />
            </div>

            {/* Net Worth Preview */}
            <div className="rounded-lg bg-muted p-3 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Net Worth</span>
                <span className="text-lg font-semibold">{formatAmount(netWorth, userCurrency)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
