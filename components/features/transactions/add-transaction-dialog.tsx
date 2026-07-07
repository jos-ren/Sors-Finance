"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { addTransaction } from "@/hooks";
import { BudgetItemPicker, fromPickerValue, toPickerValue, type PickerValue } from "@/components/features/budget/budget-item-picker";

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preset (and lock) the category/budget item, e.g. when adding from a category detail page. */
  defaultBudgetItemId?: number;
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  defaultBudgetItemId,
}: AddTransactionDialogProps) {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [assignment, setAssignment] = useState<PickerValue>(() => toPickerValue(null, defaultBudgetItemId ?? null));
  const [note, setNote] = useState<string>("");
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    const today = new Date();
    setDate(today.toISOString().split("T")[0]);
    setDescription("");
    setAmount("");
    setAssignment(toPickerValue(null, defaultBudgetItemId ?? null));
    setNote("");
    setTransactionType("expense");
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSubmitting(true);

    try {
      const transactionDate = new Date(date);
      // Set to noon to avoid timezone issues
      transactionDate.setHours(12, 0, 0, 0);

      await addTransaction({
        date: transactionDate,
        description: description.trim(),
        matchField: description.trim(),
        amountOut: transactionType === "expense" ? amountNum : 0,
        amountIn: transactionType === "income" ? amountNum : 0,
        netAmount: transactionType === "income" ? amountNum : -amountNum,
        source: "Manual",
        note: note.trim() || null,
        ...fromPickerValue(assignment),
        categoryLocked: false,
        importId: null,
      });

      toast.success("Transaction added successfully");
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to add transaction:", error);
      toast.error("Failed to add transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Manually add a new transaction to your records.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <RadioGroup
              value={transactionType}
              onValueChange={(value) => setTransactionType(value as "expense" | "income")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="expense" id="expense" />
                <Label htmlFor="expense" className="font-normal cursor-pointer">
                  Expense
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="income" id="income" />
                <Label htmlFor="income" className="font-normal cursor-pointer">
                  Income
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="e.g. Bestbuy"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (CAD)</Label>
              <CurrencyInput
                id="amount"
                placeholder="0.00"
                value={amount}
                onChange={setAmount}
              />
            </div>
          </div>

          {/* Category / budget item */}
          <div className="space-y-2">
            <Label htmlFor="category">Category (optional)</Label>
            <BudgetItemPicker
              value={assignment}
              onChange={setAssignment}
              placeholder="Uncategorized"
              disabled={defaultBudgetItemId != null}
            />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              placeholder="e.g. Rent for May, Nike running shoes..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
