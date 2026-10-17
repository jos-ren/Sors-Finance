"use client";

import { useMemo, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-card";
import { toast } from "sonner";
import { generateId } from "@/lib/utils/generate-id";
import { FileUpload } from "@/components/features/transactions/file-upload";
import { PlaidAccountSelector } from "@/components/plaid-account-selector";
import { Transaction, UploadedFile } from "@/types";
import { parseFile } from "@/lib/parsers";
import { categorizeTransactions } from "@/lib/categories/categorizer";
import { matchGlobalDictionary } from "@/lib/categories/global-dictionary";
import { matchPlaidCategory } from "@/lib/categories/plaid-category";
import {
  useCategories,
  invalidateTransactions,
  invalidateImports,
} from "@/hooks";
import { useBudgetHierarchy } from "@/hooks/use-budget";
import { useProjects } from "@/hooks/use-projects";
import { matchProject } from "@/lib/projects/match";
import {
  addTransactionsBulk,
  addPlaidDetails,
  addImport,
  deleteImport,
  findDuplicateSignatures,
} from "@/lib/db/client";
import type { DbCategory } from "@/lib/db/types";
import type { FetchedPlaidTransaction, PlaidEnrichment } from "@/lib/plaid/types";

/* eslint-disable @next/next/no-img-element */

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "source" | "manual" | "plaid" | "processing";

/** Normalize a date to local YYYY-MM-DD for duplicate signatures. */
function normalizeDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** YYYY-MM-DD → local midnight, the same convention the file parsers use. */
function parseLocalDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Counts from the Plaid fetch that never reach the pipeline, for the summary toast. */
interface PlaidExtras {
  alreadyImported: number;
  enriched: number;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const [step, setStep] = useState<Step>("source");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Live data used to categorize the incoming rows.
  const dbCategories = useCategories();
  const hierarchy = useBudgetHierarchy(false);
  const categories = useMemo(() => dbCategories || [], [dbCategories]);
  const projects = useProjects();

  // Matchable targets: active budget categories + system categories, uuid-keyed.
  const assignables = useMemo<DbCategory[]>(() => {
    const items: DbCategory[] = (hierarchy?.subcategories ?? []).map((c) => ({
      id: c.id,
      uuid: c.uuid,
      name: c.name,
      keywords: c.keywords ?? [],
      order: c.order,
      isSystem: false,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
    return [...items, ...categories];
  }, [hierarchy, categories]);

  const itemUuids = useMemo(
    () => new Set((hierarchy?.subcategories ?? []).map((c) => c.uuid)),
    [hierarchy]
  );

  // Targets the global dictionary can fuzzy-match a merchant to (by name).
  const dictionaryTargets = useMemo(
    () => assignables.map((c) => ({ uuid: c.uuid, name: c.name })),
    [assignables]
  );

  const reset = () => {
    setStep("source");
    setUploadedFiles([]);
    setErrors([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  /**
   * The silent engine: dedup (discard) → user keywords (trusted single-match
   * auto-clears) → global dictionary gap-fill (first-time suggestion → pending).
   * Project keywords then tag rows inside a project's dates. Then create
   * import records and bulk-insert with review state.
   */
  const runPipelineAndInsert = async (
    rawTransactions: Transaction[],
    method: "manual" | "plaid",
    plaidExtras: PlaidExtras = { alreadyImported: 0, enriched: 0 }
  ): Promise<boolean> => {
    // Step A — Deduplication: silently discard exact matches. Plaid rows were
    // already deduped on their transaction id by the fetch route.
    const duplicateSignatures = await findDuplicateSignatures(rawTransactions);
    const deduped = rawTransactions.filter((t) => {
      if (t.plaidTransactionId) return true;
      const sig = `${t.source}|${normalizeDate(t.date)}|${t.description}|${t.amountOut}|${t.amountIn}`;
      return !duplicateSignatures.has(sig);
    });
    const duplicatesSkipped = rawTransactions.length - deduped.length + plaidExtras.alreadyImported;

    if (deduped.length === 0) {
      const parts: string[] = [];
      if (plaidExtras.enriched > 0) {
        parts.push(
          `Updated ${plaidExtras.enriched} existing transaction${plaidExtras.enriched !== 1 ? "s" : ""} with bank details`
        );
      }
      if (duplicatesSkipped > 0) parts.push(`${duplicatesSkipped} already imported`);
      toast.info(parts.length > 0 ? parts.join(" · ") : "No transactions to import.");
      return true;
    }

    // Steps B & C — user keywords, then global dictionary for the gaps.
    const categorized = categorizeTransactions(deduped, assignables);
    const finalized = categorized.map((t) => {
      if (t.isConflict) {
        // Multiple user keywords matched → needs resolution in the inbox.
        return { ...t, categoryId: null as string | null, _reviewStatus: "pending" as const };
      }
      if (t.categoryId) {
        // Single user keyword match → trusted, auto-clears into the ledger.
        return { ...t, _reviewStatus: "reviewed" as const };
      }
      // No user match → try the global dictionary (day-one suggestion).
      const global = matchGlobalDictionary(t.matchField, dictionaryTargets);
      if (global) {
        return { ...t, categoryId: global.categoryUuid, _reviewStatus: "pending" as const };
      }
      // Last resort → the bank's own category (Plaid), when it is confident.
      const fromBank = matchPlaidCategory(t.details?.plaidCategory, dictionaryTargets);
      if (fromBank) {
        return { ...t, categoryId: fromBank.uuid, _reviewStatus: "pending" as const };
      }
      // Truly uncategorized → needs review.
      return { ...t, _reviewStatus: "pending" as const };
    });

    // Create one import record per source so transactions link back to it.
    const sources = [...new Set(finalized.map((t) => t.source))];
    const batchId = sources.length > 1 ? generateId() : null;
    const importIdMap = new Map<string, number>();

    for (const source of sources) {
      const sourceTxns = finalized.filter((t) => t.source === source);
      const sourceAmount = sourceTxns.reduce((sum, t) => sum + t.amountOut, 0);
      let fileName: string;
      if (method === "plaid") {
        fileName = source || "Plaid Import";
      } else {
        const matched = uploadedFiles.find(
          (f) => f.templateName === source || f.file.name.includes(source) || source.includes(f.file.name)
        );
        fileName = matched?.file.name || source || "Import";
      }
      const importId = await addImport({
        fileName,
        source,
        transactionCount: sourceTxns.length,
        totalAmount: sourceAmount,
        batchId,
        method,
      });
      importIdMap.set(source, importId);
    }

    const toDbFormat = (txns: typeof finalized) =>
      txns.map((t) => {
        const assignable = t.categoryId ? assignables.find((c) => c.uuid === t.categoryId) : undefined;
        const isItem = t.categoryId ? itemUuids.has(t.categoryId) : false;
        return {
          uuid: t.id,
          date: t.date,
          description: t.description,
          matchField: t.matchField,
          amountOut: t.amountOut,
          amountIn: t.amountIn,
          netAmount: t.netAmount,
          source: t.source,
          sourceMethod: t.sourceMethod,
          sourceAccountName: t.sourceAccountName,
          plaidTransactionId: t.plaidTransactionId ?? null,
          originalDescription: t.originalDescription ?? null,
          merchantName: t.merchantName ?? null,
          transactedAt: t.transactedAt ?? null,
          details: t.details ?? null,
          categoryId: isItem ? null : assignable?.id ?? null,
          budgetItemId: isItem ? assignable?.id ?? null : null,
          categoryLocked: false,
          reviewStatus: t._reviewStatus,
          conflictCategories: t.isConflict ? t.conflictingCategories ?? null : null,
          importId: importIdMap.get(t.source) ?? null,
          projectId: matchProject(t.matchField, t.date, projects ?? []),
        };
      });

    try {
      const { inserted } = await addTransactionsBulk(toDbFormat(finalized));
      invalidateTransactions();
      invalidateImports();

      if (method === "plaid") {
        // Remember the most recent Plaid import date (best effort).
        const latest = finalized.reduce<Date | null>((max, t) => (!max || t.date > max ? t.date : max), null);
        if (latest) {
          try {
            await fetch("/api/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: "LAST_PLAID_IMPORT_DATE", value: normalizeDate(latest) }),
            });
          } catch {
            /* non-critical */
          }
        }
      }

      const needsReview = finalized.filter((t) => t._reviewStatus === "pending").length;
      const parts = [`Imported ${inserted} transaction${inserted !== 1 ? "s" : ""}`];
      if (needsReview > 0) parts.push(`${needsReview} need review`);
      if (plaidExtras.enriched > 0) parts.push(`${plaidExtras.enriched} existing updated with bank details`);
      if (duplicatesSkipped > 0) parts.push(`${duplicatesSkipped} duplicate${duplicatesSkipped !== 1 ? "s" : ""} skipped`);
      toast.success(parts.join(" · "));
      return true;
    } catch (err) {
      // Roll back the import records we created so we don't leave orphans.
      for (const id of importIdMap.values()) {
        try {
          await deleteImport(id);
        } catch {
          /* best effort */
        }
      }
      console.error("Import failed:", err);
      toast.error("Failed to import. Please try again.");
      return false;
    }
  };

  const handleProcessFiles = async () => {
    setErrors([]);
    setStep("processing");
    try {
      const allTransactions: Transaction[] = [];
      const allErrors: string[] = [];

      for (const uploadedFile of uploadedFiles) {
        if (!uploadedFile.bankId) {
          allErrors.push(`Unknown bank type for file: ${uploadedFile.file.name}`);
          continue;
        }
        const result = await parseFile(uploadedFile.file, uploadedFile.bankId, uploadedFile.columnMapping);
        for (const parsed of result.transactions) {
          allTransactions.push({
            id: generateId(),
            ...parsed,
            source: uploadedFile.templateName || result.bankId,
            sourceMethod: "CSV",
            categoryId: null,
            isConflict: false,
          });
        }
        allErrors.push(...result.errors);
      }

      if (allTransactions.length === 0) {
        setErrors(allErrors.length > 0 ? allErrors : ["No transactions found in the selected files."]);
        setStep("manual");
        return;
      }

      const ok = await runPipelineAndInsert(allTransactions, "manual");
      if (ok) {
        handleOpenChange(false);
      } else {
        setErrors(allErrors);
        setStep("manual");
      }
    } catch (error) {
      setErrors([`Error processing files: ${error instanceof Error ? error.message : "Unknown error"}`]);
      setStep("manual");
    }
  };

  const handlePlaidFetch = async (
    accountsByItem: Map<number, { accountIds: string[]; institutionName: string }>,
    startDate: string,
    endDate: string
  ) => {
    setErrors([]);
    setStep("processing");
    try {
      let allPlaidTransactions: Transaction[] = [];
      let allEnrichments: PlaidEnrichment[] = [];
      let alreadyImported = 0;
      const fetchErrors: string[] = [];

      for (const [itemId, { accountIds, institutionName }] of accountsByItem.entries()) {
        try {
          const response = await fetch("/api/plaid/transactions/fetch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId, accountIds, startDate, endDate }),
          });
          if (!response.ok) {
            const error = await response.json();
            const code = error.errorCode ? ` (${error.errorCode})` : "";
            fetchErrors.push(`${institutionName}: ${error.error || "Failed to fetch"}${code}`);
            continue;
          }
          const data = await response.json();
          const plaidTransactions = (data.transactions as FetchedPlaidTransaction[]).map(
            ({ day, transactedAt, originalDescription, merchantName, ...t }): Transaction => ({
              ...t,
              id: generateId(),
              date: parseLocalDay(day),
              transactedAt: transactedAt ? new Date(transactedAt) : null,
              originalDescription: originalDescription ?? undefined,
              merchantName: merchantName ?? undefined,
              categoryId: null,
              isConflict: false,
            })
          );
          allPlaidTransactions = [...allPlaidTransactions, ...plaidTransactions];
          allEnrichments = [...allEnrichments, ...(data.enrichments ?? [])];
          alreadyImported += data.alreadyImported ?? 0;
        } catch (err) {
          fetchErrors.push(`${institutionName}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      // Older Plaid rows found again: backfill their details and fix the date.
      let enriched = 0;
      if (allEnrichments.length > 0) {
        try {
          enriched = await addPlaidDetails(
            allEnrichments.map((e) => ({
              id: e.id,
              date: parseLocalDay(e.day),
              plaidTransactionId: e.plaidTransactionId,
              matchField: e.matchField,
              originalDescription: e.originalDescription,
              merchantName: e.merchantName,
              transactedAt: e.transactedAt,
              details: e.details,
            }))
          );
          if (enriched > 0) invalidateTransactions();
        } catch {
          fetchErrors.push("Could not update existing transactions with bank details.");
        }
      }

      if (allPlaidTransactions.length === 0 && enriched === 0 && alreadyImported === 0) {
        setErrors(fetchErrors.length > 0 ? fetchErrors : ["No transactions found for the selected date range and accounts."]);
        setStep("plaid");
        return;
      }

      const ok = await runPipelineAndInsert(allPlaidTransactions, "plaid", { alreadyImported, enriched });
      if (ok && fetchErrors.length === 0) {
        handleOpenChange(false);
      } else {
        // Keep the dialog open so a bank that failed isn't hidden behind one that worked.
        setErrors(fetchErrors);
        setStep("plaid");
      }
    } catch (error) {
      setErrors([`Error fetching Plaid transactions: ${error instanceof Error ? error.message : "Unknown error"}`]);
      setStep("plaid");
    }
  };

  const filesReady =
    uploadedFiles.length > 0 &&
    !uploadedFiles.some(
      (f) =>
        f.bankId === null ||
        (f.validationErrors && f.validationErrors.length > 0) ||
        ((f.bankId === "CUSTOM" || f.bankId?.startsWith("TEMPLATE_")) && !f.mappingConfigured)
    );

  // Widen the dialog for the file/plaid steps which need more room.
  const wide = step === "manual" || step === "plaid";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={wide ? "sm:max-w-2xl" : "sm:max-w-lg"}>
        <DialogHeader>
          <DialogTitle>Import Transactions</DialogTitle>
          <DialogDescription>
            {step === "plaid"
              ? "Choose which accounts and date range to sync."
              : step === "manual"
                ? "Upload a CSV or Excel file exported from your bank."
                : "Sync your bank or upload a file. Matched transactions land in your review inbox."}
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 && (
          <InfoCard variant="danger" title="Something went wrong:">
            <ul className="list-disc list-inside mt-1">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </InfoCard>
        )}

        {step === "source" && (
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <Card
              className="cursor-pointer transition-colors hover:border-primary/50"
              onClick={() => setStep("manual")}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <FileUp className="h-10 w-10 text-muted-foreground" />
                <div>
                  <h4 className="font-semibold text-base">Upload CSV</h4>
                  <CardDescription className="mt-1">Import from a CSV or Excel file</CardDescription>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-colors hover:border-primary/50"
              onClick={() => setStep("plaid")}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <img src="/logos/plaid.png" alt="Plaid" className="h-10 w-auto object-contain" />
                <div>
                  <h4 className="font-semibold text-base">Sync Bank</h4>
                  <CardDescription className="mt-1">Connect your bank via Plaid</CardDescription>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "manual" && (
          <div className="space-y-4">
            <FileUpload onFilesSelected={setUploadedFiles} />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setUploadedFiles([]); setErrors([]); setStep("source"); }}>
                Back
              </Button>
              <Button onClick={handleProcessFiles} disabled={!filesReady}>
                Import
              </Button>
            </div>
          </div>
        )}

        {step === "plaid" && (
          <div className="max-h-[70vh] overflow-y-auto">
            <PlaidAccountSelector onFetchTransactions={handlePlaidFetch} onBack={() => { setErrors([]); setStep("source"); }} />
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processing transactions…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
