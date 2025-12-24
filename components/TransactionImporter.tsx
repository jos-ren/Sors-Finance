"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, AlertTriangle, HelpCircle, Copy } from "lucide-react";

type ResolveSubStep = "conflicts" | "uncategorized" | "duplicates";
import { toast } from "sonner";
import { FileUpload } from "@/components/FileUpload";
import { CategoryManager } from "@/components/CategoryManager";
import { ConflictResolver } from "@/components/ConflictResolver";
import { DuplicateResolver } from "@/components/DuplicateResolver";
import { UncategorizedList } from "@/components/UncategorizedList";
import { ResultsView } from "@/components/ResultsView";
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
  addCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "@/lib/hooks";
import { DbCategory, addTransactionsBulk, addImport, findDuplicateSignatures } from "@/lib/db";

interface TransactionImporterProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function TransactionImporter({ onComplete, onCancel }: TransactionImporterProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("upload");
  const [resolveSubStep, setResolveSubStep] = useState<ResolveSubStep>("conflicts");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Load categories from Dexie (live query)
  const dbCategories = useCategories();
  const categories = dbCategories || [];

  // Calculate summary
  const summary = getCategorizationSummary(transactions);

  // Determine which resolve sub-steps are needed (show step if there are ANY transactions of that type)
  const resolveSteps = useMemo(() => {
    const steps: ResolveSubStep[] = [];
    // Show conflicts step if there are any conflict transactions (resolved or not)
    if (transactions.some(t => t.isConflict)) steps.push("conflicts");
    // Show uncategorized step if there are any uncategorized transactions (ignored or not)
    if (transactions.some(t => !t.categoryId && !t.isConflict)) steps.push("uncategorized");
    // Show duplicates step if there are any duplicate transactions
    if (transactions.some(t => t.isDuplicate)) steps.push("duplicates");
    return steps;
  }, [transactions]);

  // Get current step index and navigation info
  const currentStepIndex = resolveSteps.indexOf(resolveSubStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === resolveSteps.length - 1;
  const hasNextStep = currentStepIndex < resolveSteps.length - 1;

  // Auto-navigate to first valid sub-step if current one is no longer valid
  if (currentStep === "resolve" && transactions.length > 0 && resolveSteps.length > 0) {
    if (!resolveSteps.includes(resolveSubStep)) {
      // Current sub-step is no longer valid, move to first available step
      setTimeout(() => setResolveSubStep(resolveSteps[0]), 0);
    }
  }

  // Auto-advance to next sub-step when current one is complete
  const currentSubStepComplete = useMemo(() => {
    if (resolveSubStep === "conflicts") return summary.conflicts === 0;
    if (resolveSubStep === "uncategorized") return summary.uncategorized === 0;
    if (resolveSubStep === "duplicates") return summary.duplicates === 0;
    return false;
  }, [resolveSubStep, summary]);

  // Navigate to next sub-step
  const goToNextSubStep = () => {
    if (hasNextStep) {
      setResolveSubStep(resolveSteps[currentStepIndex + 1]);
    } else {
      setCurrentStep("results");
    }
  };

  // Navigate to previous sub-step
  const goToPrevSubStep = () => {
    if (!isFirstStep) {
      setResolveSubStep(resolveSteps[currentStepIndex - 1]);
    }
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

      // Mark duplicates and categorize transactions
      const withDuplicates = allTransactions.map(t => {
        const signature = `${t.date.toISOString()}|${t.description}|${t.amountOut}|${t.amountIn}`;
        return {
          ...t,
          isDuplicate: duplicateSignatures.has(signature),
          allowDuplicate: false,
        };
      });

      // Categorize transactions
      const categorized = categorizeTransactions(withDuplicates, categories);
      setTransactions(categorized);

      // Reset sub-step and move to resolve step
      setResolveSubStep("conflicts");
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
  };

  const handleResolveConflict = (transactionId: string, categoryId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? assignCategory(t, categoryId) : t
      )
    );
  };

  const handleUndoConflict = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, categoryId: null } : t
      )
    );
  };

  const handleAllowDuplicate = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, allowDuplicate: true } : t
      )
    );
  };

  const handleIgnoreDuplicate = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, ignoreDuplicate: true, allowDuplicate: false } : t
      )
    );
  };

  const handleUndoDuplicate = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, ignoreDuplicate: false, allowDuplicate: false } : t
      )
    );
  };

  const handleIgnoreAllDuplicates = () => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.isDuplicate && !t.allowDuplicate && !t.ignoreDuplicate
          ? { ...t, ignoreDuplicate: true }
          : t
      )
    );
  };

  const handleAllowAllDuplicates = () => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.isDuplicate && !t.allowDuplicate && !t.ignoreDuplicate
          ? { ...t, allowDuplicate: true }
          : t
      )
    );
  };

  const handleIgnoreUncategorized = (transactionId: string) => {
    // Mark transaction as ignored (will be imported without category)
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, isIgnored: true } : t
      )
    );
  };

  const handleIgnoreAllUncategorized = () => {
    // Mark all uncategorized transactions as ignored
    setTransactions((prev) =>
      prev.map((t) =>
        !t.categoryId && !t.isConflict && !t.isIgnored ? { ...t, isIgnored: true } : t
      )
    );
  };

  const handleUndoIgnoreUncategorized = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, isIgnored: false } : t
      )
    );
  };

  const handleAddKeyword = async (categoryId: string, keyword: string) => {
    // Find the category by uuid and add keyword
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
    // Dexie live query will auto-update, reprocess after a delay
    setTimeout(handleReprocessTransactions, 100);
  };

  const handleCategoryDelete = async (id: number) => {
    const categoryToDelete = categories.find((cat) => cat.id === id);
    if (!categoryToDelete) return;

    await deleteCategory(id);
    toast.success(`Deleted "${categoryToDelete.name}"`);
    // Dexie live query will auto-update
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
  };

  const handleFinish = async () => {
    try {
      // Filter out ignored duplicates and ignored uncategorized
      const transactionsToImport = transactions.filter(t => !t.ignoreDuplicate);

      // Separate allowed duplicates from normal transactions
      const allowedDuplicates = transactionsToImport.filter(t => t.isDuplicate && t.allowDuplicate);
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
      for (const [source, sourceTransactions] of normalBySource) {
        const dbTransactions = convertToDbFormat(sourceTransactions);
        const { added, skipped } = await addTransactionsBulk(dbTransactions);
        totalAdded += added;
        totalSkipped += skipped;
      }

      // Process allowed duplicates (skip duplicate checking)
      if (allowedDuplicates.length > 0) {
        const dbTransactions = convertToDbFormat(allowedDuplicates);
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

  // Get categorization summary (already calculated above for auto-navigate)
  const conflictTransactions = transactions.filter((t) => t.isConflict);
  // Include ignored transactions so they stay visible with status
  const uncategorizedTransactions = transactions.filter(
    (t) => !t.categoryId && !t.isConflict
  );
  const duplicateTransactions = transactions.filter((t) => t.isDuplicate);
  const hasIssues = summary.conflicts > 0 || summary.uncategorized > 0 || summary.duplicates > 0;
  // Blocking issues prevent import: conflicts must be resolved, duplicates must be handled
  // Uncategorized is OK - they'll be imported without a category
  const hasBlockingIssues = summary.conflicts > 0 || summary.duplicates > 0;
  // Allow viewing results even with issues - user can always go back to resolve more
  const canViewResults = transactions.length > 0;

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
            {summary.total > 0 && (
              <span className="ml-2 text-xs">
                ({summary.conflicts + summary.uncategorized + summary.duplicates} issues)
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!canViewResults}>
            3. View Results
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
              disabled={uploadedFiles.length === 0 || isProcessing || uploadedFiles.some(f => f.bankType === "UNKNOWN")}
            >
              {isProcessing ? "Processing..." : "Process Files"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="resolve" className="flex flex-col flex-1 min-h-0 mt-0 gap-4">
          {/* Sub-step Progress Indicator */}
          {resolveSteps.length > 0 && (
            <div className="flex items-center justify-center gap-2 flex-shrink-0 py-2">
              {resolveSteps.map((step, index) => {
                const isCurrent = step === resolveSubStep;
                const isComplete =
                  (step === "conflicts" && summary.conflicts === 0) ||
                  (step === "uncategorized" && summary.uncategorized === 0) ||
                  (step === "duplicates" && summary.duplicates === 0);

                const getStepLabel = () => {
                  switch (step) {
                    case "conflicts": return "Conflicts";
                    case "uncategorized": return "Uncategorized";
                    case "duplicates": return "Duplicates";
                  }
                };

                const getStepIcon = () => {
                  if (isComplete) return <CheckCircle2 className="h-4 w-4" />;
                  switch (step) {
                    case "conflicts": return <AlertTriangle className="h-4 w-4" />;
                    case "uncategorized": return <HelpCircle className="h-4 w-4" />;
                    case "duplicates": return <Copy className="h-4 w-4" />;
                  }
                };

                const getStepCount = () => {
                  switch (step) {
                    case "conflicts": return summary.conflicts;
                    case "uncategorized": return summary.uncategorized;
                    case "duplicates": return summary.duplicates;
                  }
                };

                return (
                  <div key={step} className="flex items-center gap-2">
                    {index > 0 && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <button
                      onClick={() => setResolveSubStep(step)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isCurrent
                          ? "bg-primary text-primary-foreground"
                          : isComplete
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {getStepIcon()}
                      {getStepLabel()}
                      {!isComplete && (
                        <span className="text-xs opacity-80">({getStepCount()})</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Current Sub-step Content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {resolveSubStep === "conflicts" && conflictTransactions.length > 0 && (
              <ConflictResolver
                conflictTransactions={conflictTransactions}
                categories={categories}
                onResolve={handleResolveConflict}
                onUndo={handleUndoConflict}
              />
            )}

            {resolveSubStep === "uncategorized" && uncategorizedTransactions.length > 0 && (
              <UncategorizedList
                uncategorizedTransactions={uncategorizedTransactions}
                categories={categories}
                onAddKeyword={handleAddKeyword}
                onCreateCategory={handleCreateCategory}
                onReprocess={handleReprocessTransactions}
                onIgnore={handleIgnoreUncategorized}
                onUndo={handleUndoIgnoreUncategorized}
                onIgnoreAll={handleIgnoreAllUncategorized}
              />
            )}

            {resolveSubStep === "duplicates" && duplicateTransactions.length > 0 && (
              <DuplicateResolver
                duplicateTransactions={duplicateTransactions}
                onAllow={handleAllowDuplicate}
                onIgnore={handleIgnoreDuplicate}
                onUndo={handleUndoDuplicate}
                onIgnoreAll={handleIgnoreAllDuplicates}
                onAllowAll={handleAllowAllDuplicates}
              />
            )}

            {/* Step status message */}
            {currentSubStepComplete && resolveSteps.length > 0 && (
              <Alert className="mt-4 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {resolveSubStep === "conflicts" && "All conflicts resolved!"}
                  {resolveSubStep === "uncategorized" && "All uncategorized transactions handled!"}
                  {resolveSubStep === "duplicates" && "All duplicates handled!"}
                  {" You can review your choices above or continue."}
                </AlertDescription>
              </Alert>
            )}
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

          {/* Navigation Buttons */}
          <div className="flex justify-center gap-3 flex-shrink-0">
            <Button variant="outline" onClick={handleReset}>
              Start Over
            </Button>
            {resolveSteps.length > 0 && !isFirstStep && (
              <Button variant="outline" onClick={goToPrevSubStep}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            {resolveSteps.length > 0 && hasNextStep && (
              <Button variant="outline" onClick={goToNextSubStep}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            <Button
              onClick={() => setCurrentStep("results")}
              disabled={!canViewResults}
            >
              View Results
              {hasBlockingIssues && <span className="ml-1 text-xs">({summary.conflicts + summary.duplicates} blocking)</span>}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="results" className="flex flex-col flex-1 min-h-0 mt-0 gap-4">
          {hasBlockingIssues && (
            <Alert variant="destructive" className="flex-shrink-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Cannot import yet:</strong>
                {summary.conflicts > 0 && ` ${summary.conflicts} conflicts need resolution.`}
                {summary.duplicates > 0 && ` ${summary.duplicates} duplicates need to be allowed or ignored.`}
                {" "}Go back to resolve these issues.
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
