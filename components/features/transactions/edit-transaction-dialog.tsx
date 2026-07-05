"use client";

import { useState, useEffect } from "react";
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
import { DbTransaction } from "@/lib/db";
import { updateTransaction } from "@/lib/db/client";
import { BudgetItemPicker, fromPickerValue, toPickerValue, type PickerValue } from "@/components/features/budget/budget-item-picker";

interface EditTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: DbTransaction | null;
}

export function EditTransactionDialog({
  open,
  onOpenChange,
  transaction,
}: EditTransactionDialogProps) {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [assignment, setAssignment] = useState<PickerValue>(null);
  const [categoryChanged, setCategoryChanged] = useState(false);
  const [source, setSource] = useState<string>("Manual");
  const [note, setNote] = useState<string>("");
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form when transaction changes
  useEffect(() => {
    if (transaction) {
      setCategoryChanged(false);
      // Format date for input
      const dateStr = transaction.date.toISOString().split("T")[0];
      setDate(dateStr);
      setDescription(transaction.description);

      // Determine transaction type and amount
      if (transaction.amountOut > 0) {
        setTransactionType("expense");
        setAmount(transaction.amountOut.toString());
      } else {
        setTransactionType("income");
        setAmount(transaction.amountIn.toString());
      }

      setAssignment(toPickerValue(transaction.categoryId, transaction.budgetItemId));
      setSource(transaction.source);
      setNote(transaction.note || "");
    }
  }, [transaction]);

  const handleSubmit = async () => {
    if (!transaction) return;

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

      await updateTransaction(transaction.id!, {
        date: transactionDate,
        description: description.trim(),
        matchField: description.trim(),
        amountOut: transactionType === "expense" ? amountNum : 0,
        amountIn: transactionType === "income" ? amountNum : 0,
        netAmount: transactionType === "income" ? amountNum : -amountNum,
        source,
        note: note.trim() || null,
        ...fromPickerValue(assignment),
        ...(categoryChanged && { categoryLocked: true }),
      });

      toast.success("Transaction updated successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update transaction:", error);
      toast.error("Failed to update transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            Make changes to this transaction.
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
                <RadioGroupItem value="expense" id="edit-expense" />
                <Label htmlFor="edit-expense" className="font-normal cursor-pointer">
                  Expense
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="income" id="edit-income" />
                <Label htmlFor="edit-income" className="font-normal cursor-pointer">
                  Income
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="edit-date">Date</Label>
            <Input
              id="edit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              placeholder="e.g. Bestbuy"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="edit-amount">Amount (CAD)</Label>
            <CurrencyInput
              id="edit-amount"
              placeholder="0.00"
              value={amount}
              onChange={setAmount}
            />
          </div>

          {/* Category / budget item */}
          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <BudgetItemPicker
              value={assignment}
              onChange={(v) => { setCategoryChanged(true); setAssignment(v); }}
              placeholder="Uncategorized"
            />
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label htmlFor="edit-source">Source</Label>
            <Input
              id="edit-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g., My Bank, CSV Import, Plaid"
            />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="edit-note">Note (optional)</Label>
            <Textarea
              id="edit-note"
              placeholder="e.g. Rent for May, Nike running shoes..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
