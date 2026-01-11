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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, HelpCircle, Copy, RotateCcw, CircleCheck, X, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import Link from "next/link";
import { toast } from "sonner";
import { FileUpload } from "@/components/FileUpload";
import { ConflictResolver } from "@/components/ConflictResolver";
import { DuplicateResolver } from "@/components/DuplicateResolver";
import { UncategorizedList, UncategorizedBulkActions } from "@/components/UncategorizedList";
import { ResultsView } from "@/components/ResultsView";
import {
  ResolveSection,
  TransactionTable,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
  DateCell,
  DescriptionCell,
  AmountCell,
} from "@/components/resolve-step";
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
  addCategory,
  updateCategory,
} from "@/lib/hooks";
import { addTransactionsBulk, addImport, findDuplicateSignatures } from "@/lib/db/client";
import { SYSTEM_CATEGORIES } from "@/lib/db";

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
  const [currentStep, setCurrentStep] = useState<WizardStep>("upload");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [categoryInfoDismissed, setCategoryInfoDismissed] = useState(getCategoryInfoDismissed);

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

  // Get the Excluded category for assigning excluded transactions
  const excludedCategory = categories.find(c => c.name === SYSTEM_CATEGORIES.EXCLUDED);

  // Effect to reprocess transactions when categories change after a keyword is added
  useEffect(() => {
    if (pendingReprocess.current) {
      setTransactions(prev => {
        if (prev.length === 0) return prev;
        pendingReprocess.current = false;
        return categorizeTransactions(prev, categories);
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
    // Conflicts need action if any are unresolved (no category selected yet)
    const hasUnresolvedConflicts = newTransactions.some(t => t.isConflict && !t.categoryId);

    // Uncategorized need action if any transactions still have no category
    const hasUncategorized = newTransactions.some(t =>
      !t.categoryId && !t.isConflict && !t.isDuplicate
    );

    setSectionsOpen({
      conflicts: hasUnresolvedConflicts,
      uncategorized: hasUncategorized,
      duplicates: false, // Duplicates default to skip, no action needed
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

        const result = await parseFile(uploadedFile.file, uploadedFile.bankId);

        // Convert parsed transactions to full Transaction objects
        for (const parsed of result.transactions) {
          allTransactions.push({
            id: generateId(),
            ...parsed,
            source: result.bankId,
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
        const signature = `${t.date.toISOString()}|${t.description}|${t.amountOut}|${t.amountIn}`;
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

  const handleReprocessTransactions = () => {
    if (categories.length === 0) return;
    const categorized = categorizeTransactions(transactions, categories);
    setTransactions(categorized);
    updateSectionStates(categorized);
    toast.success("Transactions recategorized");
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

  const handleCreateCategory = async (name: string, keyword: string) => {
    await addCategory(name, [keyword]);
    // Mark for reprocess when categories update via live query
    pendingReprocess.current = true;
  };

  const handleReset = () => {
    setCurrentStep("upload");
    setTransactions([]);
    setUploadedFiles([]);
    setErrors([]);
    setSectionsOpen({
      conflicts: false,
      uncategorized: false,
      duplicates: false,
      categorized: false,
    });
  };

  const handleFinish = async () => {
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
            source: t.source as 'CIBC' | 'AMEX' | 'Manual',
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
        const fileName = uploadedFile?.file.name || `${sources.join(', ')} Import`;
        const totalAmount = transactions.reduce((sum, t) => sum + t.amountOut, 0);

        await addImport({
          fileName,
          source: sources[0],
          transactionCount: totalAdded,
          totalAmount,
        });
      }

      // Show appropriate message
      if (totalAdded === 0 && totalSkipped > 0) {
        toast.info(`All ${totalSkipped} transactions were already imported (duplicates skipped).`);
      } else if (totalSkipped > 0) {
        toast.success(`Imported ${totalAdded} transactions. Skipped ${totalSkipped} duplicates.`);
      } else {
        toast.success(`Imported ${totalAdded} transactions successfully!`);
      }

      onComplete?.();
    } catch (error) {
      console.error('Failed to save transactions:', error);
      toast.error('Failed to save transactions. Please try again.');
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
        <TabsList className="grid w-full grid-cols-3 mb-4 flex-shrink-0">
          <TabsTrigger value="upload">
            1. Upload Files
          </TabsTrigger>
          <TabsTrigger value="resolve" disabled={transactions.length === 0}>
            2. Resolve Issues
            {transactions.length > 0 && hasBlockingIssues && (
              <Badge variant="destructive" className="ml-2">
                {unresolvedConflicts + unresolvedDuplicates}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="results" disabled={transactions.length === 0 || hasBlockingIssues}>
            3. Review & Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="flex flex-col flex-1 min-h-0 mt-0 space-y-4">
          <FileUpload
            onFilesSelected={setUploadedFiles}
          />
          {/* Spacer to keep action buttons at bottom */}
          <div className="flex-1" />
          <div className="flex justify-center gap-3 flex-shrink-0">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleProcessFiles}
              disabled={uploadedFiles.length === 0 || isProcessing || uploadedFiles.some(f => f.bankId === null || (f.validationErrors && f.validationErrors.length > 0))}
            >
              {isProcessing ? "Processing..." : "Process Files"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="resolve" className="flex flex-col flex-1 min-h-0 mt-0 gap-3">
          {/* Category info banner */}
          {!categoryInfoDismissed && (
            <Alert className="flex-shrink-0">
              <Info className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  You can view and manage all your categories on the{" "}
                  <Link href="/categories" className="font-medium underline underline-offset-4 hover:text-primary">
                    Categories page
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
          <div className="min-h-0 max-h-full overflow-y-auto border rounded-lg">
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
              bulkActions={
                stillUncategorized > 0 && (
                  <UncategorizedBulkActions
                    onReprocess={handleReprocessTransactions}
                    hasKeywordsToApply={false}
                  />
                )
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

            {/* Duplicates Section */}
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
                      <Badge className="bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-400">
                        {importedDuplicates}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Badge className="bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">0</Badge>
                )
              }
            >
              <DuplicateResolver
                duplicateTransactions={duplicateTransactions}
                onImport={handleImportDuplicate}
                onSkip={handleSkipDuplicate}
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
              {categorizedTransactions.length > 0 && (
                <TransactionTable>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px] pl-6">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[100px]">Amount</TableHead>
                      <TableHead className="w-[200px] text-right pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categorizedTransactions.map((t) => {
                      const selectableCategories = categories.filter(c => c.name.toLowerCase() !== "uncategorized");
                      return (
                        <TableRow key={t.id}>
                          <DateCell date={t.date} />
                          <DescriptionCell description={t.description} />
                          <AmountCell amountOut={t.amountOut} amountIn={t.amountIn} />
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end">
                              <Select
                                value={t.categoryId || undefined}
                                onValueChange={(value) => handleChangeCategorizedCategory(t.id, value)}
                              >
                                <SelectTrigger className="w-[140px] h-7 text-xs">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectableCategories.map((c) => (
                                    <SelectItem key={c.uuid} value={c.uuid} className="text-xs">
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </TransactionTable>
              )}
            </ResolveSection>
          </div>

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
            <Button onClick={handleFinish} disabled={hasBlockingIssues}>
              Finish Import
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
