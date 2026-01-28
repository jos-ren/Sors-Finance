"use client";

import { useState, useMemo } from "react";
import { Plus, FileSpreadsheet, Calendar, Hash, DollarSign, FileX, Upload, ChevronDown } from "lucide-react";
import { useSetPageHeader } from "@/lib/page-header-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { BankSourceBadge } from "@/components/BankSourceBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { TransactionImporter } from "@/components/TransactionImporter";
import { TransactionDataTable } from "@/components/TransactionDataTable";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { useImports, useTransactions, useCategories, deleteTransaction, deleteTransactionsBulk, invalidateTransactions, invalidateImports } from "@/lib/hooks";
import { usePrivacy } from "@/lib/privacy-context";
import type { DbImport } from "@/lib/db";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function ImportCard({ record, formatAmount }: { record: DbImport; formatAmount: (amount: number, formatter?: (n: number) => string) => string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md border">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
        <div className="flex items-center gap-4">
          <p className="font-medium text-sm">{record.fileName}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(record.importedAt)}
            </span>
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {record.transactionCount}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {formatAmount(record.totalAmount, formatCurrency)}
            </span>
          </div>
        </div>
      </div>
      <BankSourceBadge source={record.source} size="sm" />
    </div>
  );
}

export default function TransactionsPage() {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const imports = useImports();
  const transactions = useTransactions();
  const { formatAmount } = usePrivacy();
  const categories = useCategories();

  const handleImportComplete = () => {
    invalidateTransactions();
    invalidateImports();
    setIsImportOpen(false);
  };

  // Header actions for sticky header
  const headerActions = useMemo(
    () => (
      <>
        <Button variant="outline" size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Transaction
        </Button>
        <Button size="sm" onClick={() => setIsImportOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
      </>
    ),
    []
  );

  // Set page header and get sentinel ref
  const sentinelRef = useSetPageHeader("Transactions", headerActions);

  // Sort imports by date (newest first)
  const sortedImports = imports
    ? [...imports].sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime())
    : [];

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">
              Import and manage your bank transactions
            </p>
            <div ref={sentinelRef} className="h-0" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
            <Button onClick={() => setIsImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>
        </div>

        {/* Transaction Data Table */}
        {transactions && categories && (
          <TransactionDataTable
            transactions={transactions}
            categories={categories}
            onDeleteTransaction={async (id) => {
              await deleteTransaction(id);
              toast.success("Transaction deleted");
            }}
            onBulkDeleteTransactions={async (ids) => {
              await deleteTransactionsBulk(ids);
              toast.success(`${ids.length} transaction${ids.length !== 1 ? 's' : ''} deleted`);
            }}
          />
        )}

        <Collapsible defaultOpen={false}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle>Import History</CardTitle>
                    {sortedImports.length > 0 && (
                      <Badge variant="secondary">{sortedImports.length}</Badge>
                    )}
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                </div>
                <CardDescription>
                  View your past transaction imports and their details
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {sortedImports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FileX className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="font-medium">No imports yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click &quot;Import&quot; to upload your first bank statement
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedImports.map((record) => (
                      <ImportCard key={record.id} record={record} formatAmount={formatAmount} />
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Import Dialog */}
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogContent className="max-w-[calc(100vw-4rem)] w-[1400px] h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>Import Transactions</DialogTitle>
              <DialogDescription>
                Upload your bank statements and categorize transactions
              </DialogDescription>
            </DialogHeader>
            <TransactionImporter
              onComplete={handleImportComplete}
              onCancel={() => setIsImportOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Add Transaction Dialog */}
        {categories && (
          <AddTransactionDialog
            open={isAddOpen}
            onOpenChange={setIsAddOpen}
            categories={categories}
          />
        )}
      </div>
    </>
  );
}
