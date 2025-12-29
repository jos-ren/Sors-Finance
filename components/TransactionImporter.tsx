"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, HelpCircle, Copy, RotateCcw, CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { toast } from "sonner";
import { FileUpload } from "@/components/FileUpload";
import { CategoryManager } from "@/components/CategoryManager";
import { ConflictResolver } from "@/components/ConflictResolver";
import { DuplicateResolver, DuplicateBulkActions } from "@/components/DuplicateResolver";
import { UncategorizedList, UncategorizedBulkActions } from "@/components/UncategorizedList";
import { ResultsView } from "@/components/ResultsView";
import { ResolveSection } from "@/components/resolve-step";
import { Transaction, UploadedFile, WizardStep } from "@/lib/types";
import { parseCIBC } from "@/lib/parsers/cibc";
import { parseAMEX } from "@/lib/parsers/amex";
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
  deleteCategory,
  reorderCategories,
} from "@/lib/hooks";
import { addTransactionsBulk, addImport, findDuplicateSignatures, SYSTEM_CATEGORIES } from "@/lib/db";

interface TransactionImporterProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function TransactionImporter({ onComplete, onCancel }: TransactionImporterProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("upload");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Section open states - expand sections with issues by default
  const [sectionsOpen, setSectionsOpen] = useState({
    conflicts: true,
    uncategorized: true,
    duplicates: true,
    categorized: false,
  });

  // Load categories and transactions from Dexie (live query)
  const dbCategories = useCategories();
  const dbTransactions = useTransactions();
  const categories = dbCategories || [];

  // Get the Excluded category for assigning excluded transactions
  const excludedCategory = categories.find(c => c.name === SYSTEM_CATEGORIES.EXCLUDED);

  // Calculate summary
  const summary = getCategorizationSummary(transactions);

  // Calculate categorized transactions (ready for import)
  const categorizedTransactions = useMemo(() => {
    return transactions.filter(t =>
      t.categoryId &&
      !t.isConflict &&
      !t.isDuplicate
    );
  }, [transactions]);

  // Get filtered transaction lists
  const conflictTransactions = transactions.filter((t) => t.isConflict);
  const uncategorizedTransactions = transactions.filter(
    (t) => !t.categoryId && !t.isConflict
  );
  const duplicateTransactions = transactions.filter((t) => t.isDuplicate);

  // Check for unresolved conflicts
  const unresolvedConflicts = conflictTransactions.filter(t => !t.categoryId).length;

  // Check for unresolved duplicates (neither import nor skip)
  const unresolvedDuplicates = duplicateTransactions.filter(
    t => !t.importDuplicate && !t.skipDuplicate
  ).length;

  // Blocking issues prevent import
  const hasBlockingIssues = unresolvedConflicts > 0 || unresolvedDuplicates > 0;

  // Update section open states based on counts
  const updateSectionStates = (newTransactions: Transaction[]) => {
    const newSummary = getCategorizationSummary(newTransactions);
    const newCategorized = newTransactions.filter(t =>
      t.categoryId && !t.isConflict && !t.isDuplicate
    );

    setSectionsOpen({
      conflicts: newSummary.conflicts > 0,
      uncategorized: newSummary.uncategorized > 0,
      duplicates: newSummary.duplicates > 0,
      categorized: newCategorized.length > 0 && newSummary.conflicts === 0 && newSummary.duplicates === 0,
    });
  };

  const handleProcessFiles = async () => {
    setIsProcessing(true);
    setErrors([]);

    try {
      const allTransactions: Transaction[] = [];
      const allErrors: string[] = [];

      for (const uploadedFile of uploadedFiles) {
        let result;

        if (uploadedFile.bankType === "CIBC") {
          result = await parseCIBC(uploadedFile.file);
        } else if (uploadedFile.bankType === "AMEX") {
          result = await parseAMEX(uploadedFile.file);
        } else {
          allErrors.push(
            `Unknown bank type for file: ${uploadedFile.file.name}`
          );
          continue;
        }

        allTransactions.push(...result.transactions);
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
      setTransactions(categorized);
      updateSectionStates(categorized);
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

  const handleUndoConflict = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, categoryId: null } : t
      )
    );
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

  const handleSkipAllDuplicates = () => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.isDuplicate
          ? { ...t, skipDuplicate: true, importDuplicate: false }
          : t
      )
    );
  };

  const handleImportAllDuplicates = () => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.isDuplicate
          ? { ...t, importDuplicate: true, skipDuplicate: false }
          : t
      )
    );
  };

  const handleExcludeUncategorized = (transactionId: string) => {
    if (!excludedCategory) return;
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, categoryId: excludedCategory.uuid } : t
      )
    );
  };

  const handleExcludeAllUncategorized = () => {
    if (!excludedCategory) return;
    setTransactions((prev) =>
      prev.map((t) =>
        !t.categoryId && !t.isConflict ? { ...t, categoryId: excludedCategory.uuid } : t
      )
    );
  };

  const handleUndoExcludeUncategorized = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, categoryId: null } : t
      )
    );
  };

  const handleAddKeyword = async (categoryId: string, keyword: string) => {
    const category = categories.find((c) => c.uuid === categoryId);
    if (!category || !category.id) return;

    await updateCategory(category.id, {
      keywords: [...category.keywords, keyword.trim()],
    });
    // Dexie live query will auto-update categories, then reprocess
    setTimeout(handleReprocessTransactions, 100);
  };

  const handleCreateCategory = async (name: string, keyword: string) => {
    await addCategory(name, [keyword]);
    // Dexie live query will auto-update categories, then reprocess
    setTimeout(handleReprocessTransactions, 100);
  };

  const handleCategoryAdd = async (name: string, keywords: string[]) => {
    await addCategory(name, keywords);
  };

  const handleCategoryUpdate = async (
    id: number,
    name: string,
    keywords: string[]
  ) => {
    await updateCategory(id, { name, keywords });
    setTimeout(handleReprocessTransactions, 100);
  };

  const handleCategoryDelete = async (id: number) => {
    const categoryToDelete = categories.find((cat) => cat.id === id);
    if (!categoryToDelete) return;

    await deleteCategory(id);
    toast.success(`Deleted "${categoryToDelete.name}"`);
    setTimeout(handleReprocessTransactions, 100);
  };

  const handleCategoryReorder = async (activeId: number, overId: number) => {
    await reorderCategories(activeId, overId);
  };

  const handleReset = () => {
    setCurrentStep("upload");
    setTransactions([]);
    setUploadedFiles([]);
    setErrors([]);
    setSectionsOpen({
      conflicts: true,
      uncategorized: true,
      duplicates: true,
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
        const { added, skipped } = await addTransactionsBulk(dbTransactionsToAdd);
        totalAdded += added;
        totalSkipped += skipped;
      }

      // Process duplicates marked for import (skip duplicate checking)
      if (duplicatesToImport.length > 0) {
        const dbTransactions = convertToDbFormat(duplicatesToImport);
        const { added } = await addTransactionsBulk(dbTransactions, { skipDuplicateCheck: true });
        totalAdded += added;
      }

      // Create a single import record if we added any transactions
      if (totalAdded > 0) {
        const sources = [...new Set(transactions.map(t => t.source))];
        const uploadedFile = uploadedFiles[0];
        const fileName = uploadedFile?.file.name || `${sources.join(', ')} Import`;
        const totalAmount = transactions.reduce((sum, t) => sum + t.amountOut, 0);

        await addImport({
          fileName,
          source: sources[0] as 'CIBC' | 'AMEX',
          transactionCount: totalAdded,
          totalAmount,
          importedAt: new Date(),
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
            <FileUpload
              onFilesSelected={setUploadedFiles}
            />
            <CategoryManager
              categories={categories}
              onCategoryAdd={handleCategoryAdd}
              onCategoryUpdate={handleCategoryUpdate}
              onCategoryDelete={handleCategoryDelete}
              onCategoryReorder={handleCategoryReorder}
              singleColumn
              getTransactionCount={(categoryUuid) => {
                if (!dbTransactions) return 0;
                return dbTransactions.filter(t => {
                  const category = categories.find(c => c.id === t.categoryId);
                  return category?.uuid === categoryUuid;
                }).length;
              }}
            />
          </div>
          <div className="flex justify-center gap-3 flex-shrink-0">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleProcessFiles}
              disabled={uploadedFiles.length === 0 || isProcessing || uploadedFiles.some(f => f.bankType === "UNKNOWN" || (f.validationErrors && f.validationErrors.length > 0))}
            >
              {isProcessing ? "Processing..." : "Process Files"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="resolve" className="flex flex-col flex-1 min-h-0 mt-0 gap-3">
          {/* All sections in a single scrollable container */}
          <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
            {/* Conflicts Section */}
            <ResolveSection
              title="Conflicts"
              icon={<AlertTriangle className="h-5 w-5" />}
              count={conflictTransactions.length}
              status={unresolvedConflicts === 0 ? "complete" : "pending"}
              isBlocking={true}
              isOpen={sectionsOpen.conflicts}
              onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, conflicts: open }))}
              description="These transactions matched multiple categories. Select the correct one for each."
              emptyMessage="No conflicts found"
              completeMessage={conflictTransactions.length === 0 ? "No conflicts" : "All resolved"}
            >
              <ConflictResolver
                conflictTransactions={conflictTransactions}
                categories={categories}
                onResolve={handleResolveConflict}
                onUndo={handleUndoConflict}
              />
            </ResolveSection>

            {/* Uncategorized Section */}
            <ResolveSection
              title="Uncategorized"
              icon={<HelpCircle className="h-5 w-5" />}
              count={uncategorizedTransactions.length}
              status={uncategorizedTransactions.length === 0 ? "complete" : "pending"}
              isBlocking={false}
              isOpen={sectionsOpen.uncategorized}
              onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, uncategorized: open }))}
              description="These transactions didn't match any keywords. Add keywords or exclude them from stats."
              bulkActions={
                uncategorizedTransactions.length > 0 && (
                  <UncategorizedBulkActions
                    onExcludeAll={handleExcludeAllUncategorized}
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
                onExclude={handleExcludeUncategorized}
                onUndoExclude={handleUndoExcludeUncategorized}
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
              description="These transactions already exist. Choose to import anyway or skip them."
              bulkActions={
                duplicateTransactions.length > 0 && (
                  <DuplicateBulkActions
                    onSkipAll={handleSkipAllDuplicates}
                    onImportAll={handleImportAllDuplicates}
                  />
                )
              }
              emptyMessage="No duplicates found"
              completeMessage={duplicateTransactions.length === 0 ? "No duplicates" : "All handled"}
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
              description="These transactions are ready to be imported."
              emptyMessage="No transactions ready yet"
              completeMessage={`${categorizedTransactions.length} ready to import`}
            >
              {categorizedTransactions.length > 0 && (
                <div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-2 font-medium">Date</th>
                        <th className="text-left py-2 font-medium">Description</th>
                        <th className="text-left py-2 font-medium">Category</th>
                        <th className="text-right py-2 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorizedTransactions.map((t) => {
                        const cat = categories.find(c => c.uuid === t.categoryId);
                        return (
                          <tr key={t.id} className="border-b border-border/50">
                            <td className="py-2 whitespace-nowrap text-muted-foreground">
                              {new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" }).format(t.date)}
                            </td>
                            <td className="py-2 max-w-xs truncate" title={t.description}>
                              {t.description}
                            </td>
                            <td className="py-2">
                              <Badge variant="outline" className="text-xs">
                                {cat?.name || "Unknown"}
                              </Badge>
                            </td>
                            <td className="py-2 text-right whitespace-nowrap">
                              {t.amountOut > 0 ? (
                                <span className="text-destructive">
                                  -{new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(t.amountOut)}
                                </span>
                              ) : (
                                <span className="text-green-600">
                                  +{new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(t.amountIn)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </ResolveSection>
          </div>

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
            <ResultsView transactions={transactions} categories={categories} />
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
