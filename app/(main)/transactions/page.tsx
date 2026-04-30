"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useMemo } from "react";
import { Plus, FileSpreadsheet, FileX, Upload, FileClock, Trash2 } from "lucide-react";
import { useSetPageHeader, useIsInHeader } from "@/contexts/page-header-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { TransactionImporter } from "@/components/features/transactions/transaction-importer";
import { TransactionDataTable } from "@/components/features/transactions/transaction-data-table";
import { AddTransactionDialog } from "@/components/features/transactions/add-transaction-dialog";
import { useImports, useTransactions, useCategories, useImportDrafts, invalidateImportDrafts, deleteTransaction, deleteTransactionsBulk, invalidateTransactions, invalidateImports } from "@/hooks";
import { IconBadge } from "@/components/ui/icon-badge";
import { deleteImportDraft } from "@/lib/db/client";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency, useTimezone } from "@/contexts/settings-context";
import { formatDateTime } from "@/lib/utils/formatters";
import { SectionHeader, RowGroup, AccordionRow } from "@/components/ui/section";
import type { DbImport } from "@/lib/db";
import type { DbImportDraft } from "@/lib/db/types";

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
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const imports = useImports();
  const importDrafts = useImportDrafts();
  const transactions = useTransactions();
  const { formatAmount } = usePrivacy();
  const userCurrency = useCurrency();
  const userTimezone = useTimezone();
  const categories = useCategories();

  const handleImportComplete = () => {
    invalidateTransactions();
    invalidateImports();
    invalidateImportDrafts();
    setIsImportOpen(false);
  };

  const handleDeleteDraft = async (id: number) => {
    try {
      await deleteImportDraft(id);
      invalidateImportDrafts();
      toast.success("Draft deleted");
    } catch {
      toast.error("Failed to delete draft");
    }
  };

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

  // Group by batchId; records without a batchId are their own group
  const importGroups = useMemo(() => {
    const groups: Array<{ batchId: string | null; records: DbImport[] }> = [];
    const batchMap = new Map<string, DbImport[]>();

    for (const record of sortedImports) {
      if (record.batchId) {
        const existing = batchMap.get(record.batchId);
        if (existing) {
          existing.push(record);
        } else {
          const group = [record];
          batchMap.set(record.batchId, group);
          groups.push({ batchId: record.batchId, records: group });
        }
      } else {
        groups.push({ batchId: null, records: [record] });
      }
    }
    return groups;
  }, [sortedImports]);

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

        {/* Import History */}
        <section className="space-y-2">
          <SectionHeader label="Import History" />
          <RowGroup>
            {sortedImports.length === 0 && (!importDrafts || importDrafts.length === 0) ? (
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
                subtitle={`${sortedImports.length} import${sortedImports.length !== 1 ? "s" : ""}${importDrafts && importDrafts.length > 0 ? `, ${importDrafts.length} draft${importDrafts.length !== 1 ? "s" : ""}` : ""}`}
                maxItems={50}
              >
                {/* Draft imports */}
                {importDrafts && importDrafts.length > 0 && importDrafts.map((draft) => (
                  <div key={`draft-${draft.id}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex w-9 shrink-0 justify-center">
                      <IconBadge>
                        <FileClock className="h-4 w-4 text-amber-500" />
                      </IconBadge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{draft.name}</p>
                        <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                          Draft
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {formatDateTime(new Date(draft.updatedAt), userTimezone)}  ·  {draft.transactionCount} transactions  ·  Step: {draft.currentStep}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => { if (draft.id) handleDeleteDraft(draft.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Import records */}
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
