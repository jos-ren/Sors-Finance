"use client";

import { useState, useMemo, useEffect, useRef } from "react";

// Generate unique IDs safely (works during SSR and in browsers)
let idCounter = 0;
function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `temp-${Date.now()}-${++idCounter}`;
}

/**
 * Normalize a date to YYYY-MM-DD format using local timezone
 * This ensures consistent duplicate detection regardless of timezone
 */
function normalizeDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, HelpCircle, Copy, RotateCcw, CircleCheck, X, Info, FileUp, Loader2, Save, FileClock, Trash2, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription } from "@/components/ui/card";

import Link from "next/link";
import { toast } from "sonner";
import { FileUpload } from "@/components/FileUpload";
import { PlaidAccountSelector } from "@/components/PlaidAccountSelector";
import { ConflictResolver } from "@/components/ConflictResolver";
import { DuplicateResolver } from "@/components/DuplicateResolver";
import { UncategorizedList } from "@/components/UncategorizedList";
import { CategorizedList } from "@/components/CategorizedList";
import { ResultsView } from "@/components/ResultsView";
import { ResolveSection } from "@/components/resolve-step";
import { VirtualScrollContext } from "@/components/resolve-step/VirtualScrollContext";
import { Transaction, UploadedFile, WizardStep } from "@/lib/types";
import { parseFile } from "@/lib/parsers";
import {
  categorizeTransactions,
  getCategorizationSummary,
  assignCategory,
} from "@/lib/categorizer";
import {
  useCategories,
  useTransactions,
  useImportDrafts,
  invalidateImportDrafts,
  addCategory,
  updateCategory,
} from "@/lib/hooks";
import { addTransactionsBulk, addImport, findDuplicateSignatures, saveImportDraft, deleteImportDraft } from "@/lib/db/client";
import { SYSTEM_CATEGORIES } from "@/lib/db";
import type { ImportDraftData, DbImportDraft } from "@/lib/db/types";

interface TransactionImporterProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

const CATEGORY_INFO_DISMISSED_KEY = "sors-category-info-dismissed";

function getCategoryInfoDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CATEGORY_INFO_DISMISSED_KEY) === "true";
}

export function TransactionImporter({ onComplete, onCancel }: TransactionImporterProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("source");
  const [importSource, setImportSource] = useState<"manual" | "plaid" | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Prevent double-submission
  const [errors, setErrors] = useState<string[]>([]);
  const [categoryInfoDismissed, setCategoryInfoDismissed] = useState(getCategoryInfoDismissed);
  const [plaidEndDate, setPlaidEndDate] = useState<string | null>(null); // Track Plaid end date for saving

  // Draft state
  const [draftUuid, setDraftUuid] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const importDrafts = useImportDrafts();

  const handleDismissCategoryInfo = () => {
    localStorage.setItem(CATEGORY_INFO_DISMISSED_KEY, "true");
    setCategoryInfoDismissed(true);
  };

  // Section open states - will be set dynamically after processing
  const [sectionsOpen, setSectionsOpen] = useState({
    conflicts: false,
    uncategorized: false,
    duplicates: false,
    categorized: false,
  });

  // Load categories and transactions from Dexie (live query)
  const dbCategories = useCategories();
  const dbTransactions = useTransactions();
  const categories = useMemo(() => dbCategories || [], [dbCategories]);

  // Track pending reprocess - when categories change, we need to recategorize
  const pendingReprocess = useRef(false);

  // Outer scroll container ref for shared virtual scrolling
  const outerScrollRef = useRef<HTMLDivElement>(null);

  // Get the Excluded category for assigning excluded transactions
  const excludedCategory = categories.find(c => c.name === SYSTEM_CATEGORIES.EXCLUDED);

  // Effect to reprocess transactions when categories change after a keyword is added
  // Also clears wasUncategorized for newly-categorized transactions so they auto-move to the right section
  useEffect(() => {
    if (pendingReprocess.current) {
      setTransactions(prev => {
        if (prev.length === 0) return prev;
        pendingReprocess.current = false;
        const recategorized = categorizeTransactions(prev, categories);
        return recategorized.map(t => ({
          ...t,
          wasUncategorized: t.wasUncategorized ? (!t.categoryId && !t.isConflict) : false,
        }));
      });
    }
  }, [categories]);

  // Transactions that will actually be imported (excludes skipped duplicates)
  const transactionsToImport = useMemo(() => {
    return transactions.filter(t => !t.skipDuplicate);
  }, [transactions]);

  // Calculate summary from transactions that will be imported
  const summary = getCategorizationSummary(transactionsToImport);

  // Calculate categorized transactions (ready for import)
  // Normal transactions with category + duplicates marked for import with category
  const categorizedTransactions = useMemo(() => {
    return transactions.filter(t =>
      t.categoryId &&
      !t.isConflict &&
      (!t.isDuplicate || t.importDuplicate)
    );
  }, [transactions]);

  // Get filtered transaction lists
  // Conflicts: show if conflict AND (not duplicate OR duplicate marked for import)
  const conflictTransactions = transactions.filter(
    (t) => t.isConflict && (!t.isDuplicate || t.importDuplicate)
  );
  // Uncategorized: show if ORIGINALLY uncategorized (wasUncategorized flag)
  // These stay in the list even after keywords are added and they get categorized
  const uncategorizedTransactions = transactions.filter(
    (t) => t.wasUncategorized && (!t.isDuplicate || t.importDuplicate)
  );
  const duplicateTransactions = transactions.filter((t) => t.isDuplicate);

  // Check for unresolved conflicts
  const unresolvedConflicts = conflictTransactions.filter(t => !t.categoryId).length;

  // Check for still uncategorized (originally uncategorized and still no category)
  const stillUncategorized = uncategorizedTransactions.filter(t => !t.categoryId).length;


  // Check for unresolved duplicates (neither import nor skip)
  const unresolvedDuplicates = duplicateTransactions.filter(
    t => !t.importDuplicate && !t.skipDuplicate
  ).length;

  // Count resolved duplicates by action
  const skippedDuplicates = duplicateTransactions.filter(t => t.skipDuplicate).length;
  const importedDuplicates = duplicateTransactions.filter(t => t.importDuplicate).length;

  // Blocking issues prevent import
  const hasBlockingIssues = unresolvedConflicts > 0 || unresolvedDuplicates > 0;

  // Update section open states - only open sections that need user action
  const updateSectionStates = (newTransactions: Transaction[]) => {
    // Duplicates need action if any are unresolved (neither import nor skip)
    const hasUnresolvedDuplicates = newTransactions.some(t => t.isDuplicate && !t.importDuplicate && !t.skipDuplicate);

    // Conflicts need action if any are unresolved (no category selected yet)
    const hasUnresolvedConflicts = newTransactions.some(t => t.isConflict && !t.categoryId);

    // Uncategorized need action if any transactions still have no category
    const hasUncategorized = newTransactions.some(t =>
      !t.categoryId && !t.isConflict && !t.isDuplicate
    );

    setSectionsOpen({
      duplicates: hasUnresolvedDuplicates, // Open if there are unresolved duplicates
      conflicts: hasUnresolvedConflicts,
      uncategorized: hasUncategorized,
      categorized: false, // Just informational, no action needed
    });
  };

  const handleProcessFiles = async () => {
    setIsProcessing(true);
    setErrors([]);

    try {
      const allTransactions: Transaction[] = [];
      const allErrors: string[] = [];

      for (const uploadedFile of uploadedFiles) {
        if (!uploadedFile.bankId) {
          allErrors.push(
            `Unknown bank type for file: ${uploadedFile.file.name}`
          );
          continue;
        }

        // Pass column mapping for custom imports
        const result = await parseFile(
          uploadedFile.file,
          uploadedFile.bankId,
          uploadedFile.columnMapping
        );

        // Convert parsed transactions to full Transaction objects
        for (const parsed of result.transactions) {
          allTransactions.push({
            id: generateId(),
            ...parsed,
            source: uploadedFile.templateName || result.bankId, // Use template name if available
            sourceMethod: "CSV",
            categoryId: null,
            isConflict: false,
          });
        }

        allErrors.push(...result.errors);
      }

      if (allErrors.length > 0) {
        setErrors(allErrors);
      }

      // Check for duplicates
      const duplicateSignatures = await findDuplicateSignatures(allTransactions);

      // Mark duplicates and categorize transactions (duplicates are skipped by default)
      const withDuplicates = allTransactions.map(t => {
        // Normalize date to local YYYY-MM-DD format to avoid timezone issues
        // Include source to avoid false positives across different banks
        const dateStr = normalizeDate(t.date);
        const signature = `${t.source}|${dateStr}|${t.description}|${t.amountOut}|${t.amountIn}`;
        const isDuplicate = duplicateSignatures.has(signature);
        return {
          ...t,
          isDuplicate,
          importDuplicate: false,
          skipDuplicate: isDuplicate, // Skip duplicates by default
        };
      });

      // Categorize transactions
      const categorized = categorizeTransactions(withDuplicates, categories);

      // Mark transactions that are originally uncategorized (no category, not conflict)
      // This flag stays true even after keywords are added later
      const withUncategorizedFlag = categorized.map(t => ({
        ...t,
        wasUncategorized: !t.categoryId && !t.isConflict,
      }));

      setTransactions(withUncategorizedFlag);
      updateSectionStates(withUncategorizedFlag);
      setCurrentStep("resolve");
    } catch (error) {
      setErrors([
        `Error processing files: ${error instanceof Error ? error.message : "Unknown error"}`,
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlaidTransactionsFetch = async (
    accountsByItem: Map<number, { accountIds: string[]; institutionName: string }>,
    startDate: string,
    endDate: string
  ) => {
    setIsProcessing(true);
    setErrors([]);

    try {
      // Accumulate transactions from all institutions
      let allPlaidTransactions: Transaction[] = [];
      const fetchResults: { institutionName: string; count: number }[] = [];
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
            fetchErrors.push(`${institutionName}: ${error.error || "Failed to fetch"}`);
            continue;
          }

          const data = await response.json();
          // Convert date strings back to Date objects
          const plaidTransactions = data.transactions.map((t: Transaction) => ({
            ...t,
            date: new Date(t.date),
          }));

          allPlaidTransactions = [...allPlaidTransactions, ...plaidTransactions];
          fetchResults.push({ institutionName: data.institutionName, count: data.settledCount });
        } catch (err) {
          fetchErrors.push(`${institutionName}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      // DEBUG: Log full fetch results
      console.log("=== PLAID FETCH DEBUG ===", {
        request: {
          accountsByItem: Object.fromEntries(
            Array.from(accountsByItem.entries()).map(([itemId, data]) => [
              itemId,
              { accountIds: data.accountIds, institutionName: data.institutionName }
            ])
          ),
          startDate,
          endDate,
        },
        results: {
          totalAccounts: Array.from(accountsByItem.values()).reduce((sum, item) => sum + item.accountIds.length, 0),
          totalTransactions: allPlaidTransactions.length,
          byInstitution: fetchResults,
          errors: fetchErrors,
        },
        transactions: allPlaidTransactions,
      });

      // Report any fetch errors
      if (fetchErrors.length > 0) {
        setErrors(fetchErrors);
      }

      if (allPlaidTransactions.length === 0) {
        if (fetchErrors.length === 0) {
          setErrors(["No transactions found for the selected date range and accounts."]);
        }
        return;
      }

      // Check for duplicates across all fetched transactions
      const duplicateSignatures = await findDuplicateSignatures(allPlaidTransactions);

      // Mark duplicates and categorize transactions (duplicates are skipped by default)
      const withDuplicates = allPlaidTransactions.map((t: Transaction) => {
        // Normalize date to local YYYY-MM-DD format to avoid timezone issues
        // Include source to avoid false positives across different banks
        const dateStr = normalizeDate(t.date);
        const signature = `${t.source}|${dateStr}|${t.description}|${t.amountOut}|${t.amountIn}`;
        const isDuplicate = duplicateSignatures.has(signature);
        return {
          ...t,
          isDuplicate,
          importDuplicate: false,
          skipDuplicate: isDuplicate, // Skip duplicates by default
        };
      });

      // Categorize transactions
      const categorized = categorizeTransactions(withDuplicates, categories);

      // Mark transactions that are originally uncategorized (no category, not conflict)
      // This flag stays true even after keywords are added later
      const withUncategorizedFlag = categorized.map(t => ({
        ...t,
        wasUncategorized: !t.categoryId && !t.isConflict,
      }));

      setTransactions(withUncategorizedFlag);
      updateSectionStates(withUncategorizedFlag);
      setCurrentStep("resolve");
      setPlaidEndDate(endDate); // Save end date for later

      // Show success message with breakdown
      if (fetchResults.length === 1) {
        toast.success(`Fetched ${fetchResults[0].count} transactions from ${fetchResults[0].institutionName}`);
      } else {
        const total = fetchResults.reduce((sum, r) => sum + r.count, 0);
        const breakdown = fetchResults.map(r => `${r.count} from ${r.institutionName}`).join(", ");
        toast.success(`Fetched ${total} transactions (${breakdown})`);
      }
    } catch (error) {
      setErrors([
        `Error fetching Plaid transactions: ${error instanceof Error ? error.message : "Unknown error"}`,
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResolveConflict = (transactionId: string, categoryId: string) => {
    setTransactions((prev) => {
      const updated = prev.map((t) =>
        t.id === transactionId ? assignCategory(t, categoryId) : t
      );
      return updated;
    });
  };

  const handleImportDuplicate = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, importDuplicate: true, skipDuplicate: false } : t
      )
    );
  };

  const handleSkipDuplicate = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, skipDuplicate: true, importDuplicate: false } : t
      )
    );
  };

  const handleChangeUncategorizedCategory = (transactionIds: string[], categoryId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        transactionIds.includes(t.id) ? assignCategory(t, categoryId) : t
      )
    );
  };

  const handleChangeCategorizedCategory = (transactionId: string, categoryId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? assignCategory(t, categoryId) : t
      )
    );
  };

  const handleAddKeyword = async (categoryId: string, keyword: string) => {
    const category = categories.find((c) => c.uuid === categoryId);
    if (!category || !category.id) return;

    await updateCategory(category.id, {
      keywords: [...category.keywords, keyword.trim()],
    });
    // Mark for reprocess when categories update via live query
    pendingReprocess.current = true;
  };

  const handleRemoveKeyword = async (categoryId: string, keyword: string) => {
    const category = categories.find((c) => c.uuid === categoryId);
    if (!category || !category.id) return;

    await updateCategory(category.id, {
      keywords: category.keywords.filter((k) => k !== keyword),
    });
    pendingReprocess.current = true;
  };

  const handleEditKeyword = async (categoryId: string, oldKeyword: string, newKeyword: string) => {
    const category = categories.find((c) => c.uuid === categoryId);
    if (!category || !category.id) return;

    await updateCategory(category.id, {
      keywords: category.keywords.map((k) => (k === oldKeyword ? newKeyword : k)),
    });
    pendingReprocess.current = true;
  };

  const handleCreateCategory = async (name: string, keyword: string) => {
    await addCategory(name, [keyword]);
    // Mark for reprocess when categories update via live query
    pendingReprocess.current = true;
  };

  const handleReset = () => {
    setCurrentStep("source");
    setImportSource(null);
    setTransactions([]);
    setUploadedFiles([]);
    setErrors([]);
    setDraftUuid(null);
    setSectionsOpen({
      conflicts: false,
      uncategorized: false,
      duplicates: false,
      categorized: false,
    });
  };

  // Draft serialization
  const serializeDraftData = (): ImportDraftData => ({
    currentStep,
    importSource: importSource as "manual" | "plaid",
    transactions: transactions.map((t) => ({
      ...t,
      date: t.date.toISOString(),
    })),
    plaidEndDate,
    sectionsOpen,
    errors,
    filesMeta: uploadedFiles.map((f) => ({
      name: f.file.name,
      bankId: f.bankId,
      templateName: f.templateName,
    })),
  });

  const loadDraft = (draft: DbImportDraft) => {
    const data = draft.draftData;
    setDraftUuid(draft.uuid);
    setImportSource(data.importSource);
    setPlaidEndDate(data.plaidEndDate);
    setSectionsOpen(data.sectionsOpen);
    setErrors(data.errors);
    setTransactions(
      data.transactions.map((t) => ({
        ...t,
        date: new Date(t.date),
      }))
    );
    // Restore uploaded files as empty File stubs (originals can't be serialized)
    setUploadedFiles(
      data.filesMeta.map((meta) => ({
        file: new File([], meta.name),
        bankId: meta.bankId,
        templateName: meta.templateName,
      }))
    );
    setCurrentStep(data.currentStep as WizardStep);
  };

  const handleSaveDraft = async () => {
    if (isSavingDraft || !importSource) return;
    setIsSavingDraft(true);
    try {
      const sources = [...new Set(transactions.map((t) => t.source))];
      const name =
        importSource === "plaid"
          ? sources[0] || "Plaid Import"
          : uploadedFiles[0]?.file.name || "Import Draft";

      const result = await saveImportDraft({
        uuid: draftUuid ?? undefined,
        name,
        importSource,
        currentStep,
        transactionCount: transactions.length,
        draftData: serializeDraftData(),
      });
      setDraftUuid(result.uuid);
      invalidateImportDrafts();
      toast.success("Draft saved");
    } catch {
      toast.error("Failed to save draft");
    } finally {
      setIsSavingDraft(false);
    }
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

  const handleFinish = async () => {
    // Prevent double-submission
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Filter out skipped duplicates
      const transactionsToImport = transactions.filter(t => !t.skipDuplicate);

      // Separate duplicates marked for import from normal transactions
      const duplicatesToImport = transactionsToImport.filter(t => t.isDuplicate && t.importDuplicate);
      const normalTransactions = transactionsToImport.filter(t => !t.isDuplicate);

      // Group transactions by source (file)
      const groupBySource = (txns: Transaction[]) => {
        const map = new Map<string, Transaction[]>();
        for (const t of txns) {
          const existing = map.get(t.source) || [];
          existing.push(t);
          map.set(t.source, existing);
        }
        return map;
      };

      const convertToDbFormat = (txns: Transaction[]) => {
        return txns.map(t => {
          const category = categories.find(c => c.uuid === t.categoryId);
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
            categoryId: category?.id ?? null,
            importId: null as number | null,
          };
        });
      };

      let totalAdded = 0;
      let totalSkipped = 0;

      // Process normal transactions (with duplicate checking)
      const normalBySource = groupBySource(normalTransactions);
      for (const [, sourceTransactions] of normalBySource) {
        const dbTransactionsToAdd = convertToDbFormat(sourceTransactions);
        const { inserted, skipped } = await addTransactionsBulk(dbTransactionsToAdd);
        totalAdded += inserted;
        totalSkipped += skipped;
      }

      // Process duplicates marked for import (skip duplicate checking)
      if (duplicatesToImport.length > 0) {
        const dbTransactions = convertToDbFormat(duplicatesToImport);
        const { inserted } = await addTransactionsBulk(dbTransactions, { skipDuplicates: false });
        totalAdded += inserted;
      }

      // Create a single import record if we added any transactions
      if (totalAdded > 0) {
        const sources = [...new Set(transactions.map(t => t.source))];
        const uploadedFile = uploadedFiles[0];
        
        // Generate fileName based on import source
        let fileName: string;
        if (importSource === "plaid") {
          // For Plaid: use institution name + date range or first source name
          fileName = sources[0] || "Plaid Import";
        } else {
          // For manual: use file name
          fileName = uploadedFile?.file.name || `${sources.join(', ')} Import`;
        }
        
        const totalAmount = transactions.reduce((sum, t) => sum + t.amountOut, 0);

        await addImport({
          fileName,
          source: sources[0],
          transactionCount: totalAdded,
          totalAmount,
        });
      }

      // Save last Plaid import date if this was a Plaid import
      if (importSource === "plaid" && plaidEndDate && totalAdded > 0) {
        try {
          await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: "LAST_PLAID_IMPORT_DATE", value: plaidEndDate }),
          });
        } catch {
          // Non-critical - don't fail the import if we can't save the date
          console.warn("Failed to save last Plaid import date");
        }
      }

      // Show appropriate message
      if (totalAdded === 0 && totalSkipped > 0) {
        toast.info(`All ${totalSkipped} transactions were already imported (duplicates skipped).`);
      } else if (totalSkipped > 0) {
        toast.success(`Imported ${totalAdded} transactions. Skipped ${totalSkipped} duplicates.`);
      } else {
        toast.success(`Imported ${totalAdded} transactions successfully!`);
      }

      // Delete the draft if this import was from a draft
      if (draftUuid) {
        try {
          const drafts = importDrafts ?? [];
          const draft = drafts.find((d) => d.uuid === draftUuid);
          if (draft?.id) {
            await deleteImportDraft(draft.id);
            invalidateImportDrafts();
          }
        } catch {
          // Non-critical
        }
        setDraftUuid(null);
      }

      onComplete?.();
    } catch (error) {
      console.error('Failed to save transactions:', error);
      toast.error('Failed to save transactions. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate blocking message
  const getBlockingMessage = () => {
    const parts = [];
    if (unresolvedConflicts > 0) {
      parts.push(`${unresolvedConflicts} conflict${unresolvedConflicts !== 1 ? 's' : ''}`);
    }
    if (unresolvedDuplicates > 0) {
      parts.push(`${unresolvedDuplicates} duplicate${unresolvedDuplicates !== 1 ? 's' : ''}`);
    }
    return parts.join(' and ');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {errors.length > 0 && (
        <Alert variant="destructive" className="flex-shrink-0 mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Errors occurred during processing:</strong>
            <ul className="list-disc list-inside mt-2">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={currentStep} onValueChange={(value) => setCurrentStep(value as WizardStep)} className="flex flex-col flex-1 min-h-0">
        <TabsList className="grid w-full grid-cols-4 mb-4 flex-shrink-0">
          <TabsTrigger value="source">
            1. Select Source
          </TabsTrigger>
          <TabsTrigger value="upload" disabled={importSource === null}>
            2. {importSource === "plaid" ? "Select Accounts" : "Upload Files"}
          </TabsTrigger>
          <TabsTrigger value="resolve" disabled={transactions.length === 0}>
            3. Resolve Issues
            {transactions.length > 0 && hasBlockingIssues && (
              <Badge variant="destructive" className="ml-2">
                {unresolvedConflicts + unresolvedDuplicates}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="results" disabled={transactions.length === 0 || hasBlockingIssues}>
            4. Review & Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="source" className="flex flex-col flex-1 min-h-0 mt-0 space-y-4">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Choose Import Method</h3>
            <p className="text-sm text-muted-foreground">
              Select how you want to import transactions into Sors Finance.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card
              className={`cursor-pointer transition-colors hover:border-primary/50 ${
                importSource === "manual" ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => {
                setImportSource("manual");
                setCurrentStep("upload");
              }}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <FileUp className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h4 className="font-semibold text-base">Upload Files</h4>
                  <CardDescription className="mt-1">
                    Import from CSV or Excel files exported from your bank
                  </CardDescription>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-colors hover:border-primary/50 ${
                importSource === "plaid" ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => {
                setImportSource("plaid");
                setCurrentStep("upload");
              }}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <img src="/logos/plaid.png" alt="Plaid" className="h-12 w-auto object-contain" />
                <div>
                  <h4 className="font-semibold text-base">Import from Bank</h4>
                  <CardDescription className="mt-1">
                    Import transactions directly from your bank account using Plaid
                  </CardDescription>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Continue Import - Saved Drafts */}
          {importDrafts && importDrafts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Continue a saved import</h4>
              <div className="space-y-2">
                {importDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="flex items-center justify-between py-2.5 px-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => loadDraft(draft)}
                  >
                    <div className="flex items-center gap-3">
                      <FileClock className="h-4 w-4 text-amber-500" />
                      <div className="flex items-center gap-4">
                        <p className="font-medium text-sm">{draft.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{draft.transactionCount} transactions</span>
                          <span>Step: {draft.currentStep}</span>
                          <span>Saved {new Date(draft.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {draft.importSource === "plaid" ? (
                          <><Building2 className="h-3 w-3 mr-1" />Plaid</>
                        ) : (
                          <><FileUp className="h-3 w-3 mr-1" />File</>
                        )}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (draft.id) handleDeleteDraft(draft.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spacer to keep action buttons at bottom */}
          <div className="flex-1" />
          <div className="flex justify-center gap-3 flex-shrink-0">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="upload" className="flex flex-col flex-1 min-h-0 mt-0 space-y-4">
          {importSource === "manual" ? (
            <>
              <FileUpload
                onFilesSelected={setUploadedFiles}
              />
              {/* Spacer to keep action buttons at bottom */}
              <div className="flex-1" />
              <div className="flex justify-center gap-3 flex-shrink-0">
                <Button variant="outline" onClick={() => setCurrentStep("source")}>
                  Back
                </Button>
                <Button
                  onClick={handleProcessFiles}
                  disabled={
                    uploadedFiles.length === 0 || 
                    isProcessing || 
                    uploadedFiles.some(f => 
                      f.bankId === null || 
                      (f.validationErrors && f.validationErrors.length > 0) ||
                      (f.bankId === "CUSTOM" && !f.mappingConfigured)
                    )
                  }
                >
                  {isProcessing ? "Processing..." : "Process Files"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
              <PlaidAccountSelector
                onFetchTransactions={handlePlaidTransactionsFetch}
                onBack={() => setCurrentStep("source")}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="resolve" className="flex flex-col flex-1 min-h-0 mt-0 gap-3">
          {/* Category info banner */}
          {!categoryInfoDismissed && (
            <Alert className="flex-shrink-0">
              <Info className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  You can view and manage all your categories on the{" "}
                  <Link href="/settings?tab=configs" className="font-medium underline underline-offset-4 hover:text-primary">
                    Settings → Configs
                  </Link>
                  .
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismissCategoryInfo}
                  className="shrink-0 ml-2 h-6 px-2"
                >
                  <X className="h-3 w-3" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* All sections in a single scrollable container */}
          <VirtualScrollContext.Provider value={outerScrollRef}>
          <div ref={outerScrollRef} className="min-h-0 max-h-full overflow-y-auto border rounded-lg">
            {/* Duplicates Section - FIRST to identify duplicates before anything else */}
            <ResolveSection
              title="Duplicates"
              icon={<Copy className="h-5 w-5" />}
              count={duplicateTransactions.length}
              status={unresolvedDuplicates === 0 ? "complete" : "pending"}
              isBlocking={true}
              isOpen={sectionsOpen.duplicates}
              onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, duplicates: open }))}
              description="Transactions already exist. Choose to import anyway or skip them."
              emptyMessage="No duplicates found"
              completeMessage=""
              customBadges={
                duplicateTransactions.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                      {skippedDuplicates}
                    </Badge>
                    {importedDuplicates > 0 && (
                      <Badge className="bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                        {importedDuplicates}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">0</Badge>
                )
              }
            >
              <DuplicateResolver
                duplicateTransactions={duplicateTransactions}
                onImport={handleImportDuplicate}
                onSkip={handleSkipDuplicate}
              />
            </ResolveSection>

            {/* Conflicts Section */}
            <ResolveSection
              title="Conflicts"
              icon={<AlertTriangle className="h-5 w-5" />}
              count={conflictTransactions.length}
              status={unresolvedConflicts === 0 ? "complete" : "pending"}
              isBlocking={true}
              isOpen={sectionsOpen.conflicts}
              onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, conflicts: open }))}
              description="Transactions matched multiple categories. Select the correct one for each."
              emptyMessage="No conflicts found"
              completeMessage=""
            >
              <ConflictResolver
                conflictTransactions={conflictTransactions}
                categories={categories}
                onResolve={handleResolveConflict}
                onRemoveKeyword={handleRemoveKeyword}
                onEditKeyword={handleEditKeyword}
              />
            </ResolveSection>

            {/* Uncategorized Section */}
            <ResolveSection
              title="Uncategorized"
              icon={<HelpCircle className="h-5 w-5" />}
              count={uncategorizedTransactions.length}
              status={stillUncategorized === 0 ? "complete" : "pending"}
              isBlocking={false}
              isOpen={sectionsOpen.uncategorized}
              onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, uncategorized: open }))}
              description="Transactions didn't match any keywords. Add keywords or exclude them from stats."
              customBadges={
                <Badge className="bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400">
                  {uncategorizedTransactions.length}
                </Badge>
              }
              emptyMessage="All transactions categorized"
              completeMessage="All categorized"
            >
              <UncategorizedList
                uncategorizedTransactions={uncategorizedTransactions}
                categories={categories}
                onAddKeyword={handleAddKeyword}
                onCreateCategory={handleCreateCategory}
                onChangeCategory={handleChangeUncategorizedCategory}
                excludedCategoryId={excludedCategory?.uuid}
              />
            </ResolveSection>

            {/* Categorized Section */}
            <ResolveSection
              title="Categorized"
              icon={<CircleCheck className="h-5 w-5" />}
              count={categorizedTransactions.length}
              status="info"
              isBlocking={false}
              isOpen={sectionsOpen.categorized}
              onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, categorized: open }))}
              description="Transactions which are ready to be imported."
              emptyMessage="No transactions ready yet"
              completeMessage={`${categorizedTransactions.length} ready to import`}
            >
              <CategorizedList
                transactions={categorizedTransactions}
                categories={categories}
                onChangeCategory={handleChangeCategorizedCategory}
              />
            </ResolveSection>
          </div>
          </VirtualScrollContext.Provider>

          {/* Spacer to keep action buttons at bottom */}
          <div className="flex-1" />

          {transactions.length === 0 && (
            <Alert className="flex-shrink-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No transactions to import. All transactions were either duplicates or removed.
                Click &quot;Start Over&quot; to upload different files.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center gap-3 flex-shrink-0 pt-2">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Start Over
            </Button>
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSavingDraft || transactions.length === 0}>
              <Save className="h-4 w-4 mr-1" />
              {isSavingDraft ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={() => setCurrentStep("results")}
              disabled={transactions.length === 0 || hasBlockingIssues}
            >
              Review & Import
              {hasBlockingIssues && (
                <span className="ml-1 text-xs">({getBlockingMessage()} remaining)</span>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="results" className="flex flex-col flex-1 min-h-0 mt-0 gap-4">
          {hasBlockingIssues && (
            <Alert variant="destructive" className="flex-shrink-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Cannot import yet:</strong> {getBlockingMessage()} still need to be resolved.
                Go back to resolve these issues.
              </AlertDescription>
            </Alert>
          )}

          {!hasBlockingIssues && summary.uncategorized > 0 && (
            <Alert className="flex-shrink-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> {summary.uncategorized} transactions have no category assigned. They will be imported as uncategorized.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto">
            <ResultsView transactions={transactionsToImport} categories={categories} />
          </div>

          <div className="flex justify-center gap-3 flex-shrink-0">
            <Button variant="outline" onClick={() => setCurrentStep("resolve")}>
              Back to Resolve
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Start Over
            </Button>
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSavingDraft || transactions.length === 0}>
              <Save className="h-4 w-4 mr-1" />
              {isSavingDraft ? "Saving..." : "Save Draft"}
            </Button>
            <Button onClick={handleFinish} disabled={hasBlockingIssues || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Finish Import"
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
