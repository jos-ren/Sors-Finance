"use client";

import { useState } from "react";
import { Plus, FileSpreadsheet, Calendar, Hash, DollarSign, FileX, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "sonner";
import { TransactionImporter } from "@/components/TransactionImporter";
import { TransactionDataTable } from "@/components/TransactionDataTable";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { useImports, useTransactions, useCategories } from "@/lib/hooks";
import { DbImport } from "@/lib/db";

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
  }).format(amount);
}

function ImportCard({ record }: { record: DbImport }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors border">
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
              {formatCurrency(record.totalAmount)}
            </span>
          </div>
        </div>
      </div>
      <Badge variant={record.source === "CIBC" ? "default" : "secondary"} className="text-xs">
        {record.source}
      </Badge>
    </div>
  );
}

export default function TransactionsPage() {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const imports = useImports();
  const transactions = useTransactions();
  const categories = useCategories();

  const handleImportComplete = () => {
    setIsImportOpen(false);
  };

  // Sort imports by date (newest first)
  const sortedImports = imports
    ? [...imports].sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime())
    : [];

  return (
    <>
      <Toaster position="bottom-right" richColors />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">
              Import and manage your bank transactions
            </p>
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
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Import History</CardTitle>
            <CardDescription>
              View your past transaction imports and their details
            </CardDescription>
          </CardHeader>
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
                  <ImportCard key={record.id} record={record} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
