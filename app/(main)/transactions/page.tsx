"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useMemo } from "react";
import { Plus, FileSpreadsheet, FileX, Upload } from "lucide-react";
import { useSetPageHeader, useIsInHeader } from "@/contexts/page-header-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TransactionDataTable } from "@/components/features/transactions/transaction-data-table";
import { AddTransactionDialog } from "@/components/features/transactions/add-transaction-dialog";
import { ImportDialog } from "@/components/features/transactions/import-dialog";
import { ReviewInbox } from "@/components/features/transactions/review-inbox";
import { useImports, useTransactions, useCategories, deleteTransaction, deleteTransactionsBulk } from "@/hooks";
import { IconBadge } from "@/components/ui/icon-badge";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency, useTimezone } from "@/contexts/settings-context";
import { formatDateTime } from "@/lib/utils/formatters";
import { SectionHeader, RowGroup, AccordionRow } from "@/components/ui/section";
import type { DbImport } from "@/lib/db";

function importSubtitle(record: DbImport, formatAmount: (amount: number, currency?: string, showCode?: boolean) => string, userCurrency: string) {
  return `${record.transactionCount} transactions  ·  ${formatAmount(record.totalAmount, userCurrency)}`;
}

function importIcon(record: DbImport) {
  return record.method === "plaid" ? (
    <img src="/logos/plaid.png" alt="Plaid" className="h-5 w-auto object-contain" />
  ) : (
    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
  );
}

function TransactionHeaderActions({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  const isInHeader = useIsInHeader();
  if (isInHeader) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onAdd}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Add Transaction</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onImport}>
              <Upload className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Import</TooltipContent>
        </Tooltip>
      </>
    );
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        Add Transaction
      </Button>
      <Button size="sm" onClick={onImport}>
        <Upload className="h-4 w-4 mr-2" />
        Import
      </Button>
    </>
  );
}

export default function TransactionsPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const imports = useImports();
  const transactions = useTransactions();
  const { formatAmount } = usePrivacy();
  const userCurrency = useCurrency();
  const userTimezone = useTimezone();
  const categories = useCategories();

  // Header actions for sticky header
  const headerActions = useMemo(
    () => <TransactionHeaderActions onAdd={() => setIsAddOpen(true)} onImport={() => setIsImportOpen(true)} />,
    []
  );

  // Set page header and get sentinel ref
  const sentinelRef = useSetPageHeader("Transactions", headerActions);

  // Sort imports by date (newest first) and group batches
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

        {/* Needs Review Inbox — pinned above the ledger */}
        <ReviewInbox />

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

        {/* Import History */}
        <section className="space-y-2">
          <SectionHeader label="Import History" />
          <RowGroup>
            {sortedImports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <FileX className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No imports yet</p>
                <p className="text-xs text-muted-foreground">
                  Click &quot;Import&quot; to upload your first bank statement
                </p>
              </div>
            ) : (
              <AccordionRow
                icon={<Upload className="h-4 w-4 text-muted-foreground" />}
                title="Import History"
                subtitle={`${sortedImports.length} import${sortedImports.length !== 1 ? "s" : ""}`}
                maxItems={50}
              >
                {sortedImports.map((record) => (
                  <div key={record.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex w-9 shrink-0 justify-center">
                      <IconBadge>
                        {importIcon(record)}
                      </IconBadge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{record.fileName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {importSubtitle(record, formatAmount, userCurrency)}
                      </p>
                    </div>
                    <p className="text-sm shrink-0 mr-[5px]">
                      {formatDateTime(record.importedAt, userTimezone)}
                    </p>
                  </div>
                ))}
              </AccordionRow>
            )}
          </RowGroup>
        </section>

        {/* Dialogs */}
        <AddTransactionDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
        <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      </div>
    </>
  );
}
