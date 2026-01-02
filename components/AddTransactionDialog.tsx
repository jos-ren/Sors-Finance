"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { DbCategory, SYSTEM_CATEGORIES } from "@/lib/db";
import { addTransaction } from "@/lib/db/client";

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: DbCategory[];
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  categories,
}: AddTransactionDialogProps) {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    const today = new Date();
    setDate(today.toISOString().split("T")[0]);
    setDescription("");
    setAmount("");
    setCategoryId("");
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
        uuid: crypto.randomUUID(),
        date: transactionDate,
        description: description.trim(),
        matchField: description.trim().toUpperCase(),
        amountOut: transactionType === "expense" ? amountNum : 0,
        amountIn: transactionType === "income" ? amountNum : 0,
        netAmount: transactionType === "income" ? amountNum : -amountNum,
        source: "Manual",
        categoryId: categoryId ? parseInt(categoryId) : null,
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
      <DialogContent className="sm:max-w-[425px]">
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

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category (optional)</Label>
            <Select value={categoryId || "uncategorized"} onValueChange={(value) => setCategoryId(value === "uncategorized" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
                {categories
                  .filter((cat) => cat.name !== SYSTEM_CATEGORIES.UNCATEGORIZED)
                  .map((cat) => (
                    <SelectItem key={cat.id} value={cat.id!.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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
