"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { toast, Toaster } from "sonner";
import { FileUpload } from "@/components/FileUpload";
import { CategoryManager } from "@/components/CategoryManager";
import { ConflictResolver } from "@/components/ConflictResolver";
import { UnassignedList } from "@/components/UnassignedList";
import { ResultsView } from "@/components/ResultsView";
import { Transaction, Category, UploadedFile, WizardStep } from "@/lib/types";
import { parseCIBC } from "@/lib/parsers/cibc";
import { parseAMEX } from "@/lib/parsers/amex";
import {
  categorizeTransactions,
  getCategorizationSummary,
  assignCategory,
} from "@/lib/categorizer";
import {
  loadCategories,
  saveCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  addKeywordToCategory,
  reorderCategories,
} from "@/lib/categoryStore";

export default function Home() {
  const [currentStep, setCurrentStep] = useState<WizardStep>("upload");
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Load categories on mount
  useEffect(() => {
    setCategories(loadCategories());
  }, []);

  // Auto-navigate to results if no issues
  useEffect(() => {
    if (currentStep === "resolve" && transactions.length > 0) {
      const summary = getCategorizationSummary(transactions);
      if (summary.conflicts === 0 && summary.unassigned === 0) {
        setCurrentStep("results");
      }
    }
  }, [currentStep, transactions]);

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

      // Categorize transactions
      const categorized = categorizeTransactions(allTransactions, categories);
      setTransactions(categorized);

      // Move to resolve step
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

  const handleAddKeyword = (categoryId: string, keyword: string) => {
    const updated = addKeywordToCategory(categories, categoryId, keyword);
    setCategories(updated);
    handleReprocessTransactions();
  };

  const handleCreateCategory = (name: string, keyword: string) => {
    const updated = addCategory(categories, name, [keyword]);
    setCategories(updated);
    handleReprocessTransactions();
  };

  const handleCategoryAdd = (name: string, keywords: string[]) => {
    const updated = addCategory(categories, name, keywords);
    setCategories(updated);
  };

  const handleCategoryUpdate = (
    id: string,
    name: string,
    keywords: string[]
  ) => {
    const updated = updateCategory(categories, id, { name, keywords });
    setCategories(updated);
    handleReprocessTransactions();
  };

  const handleCategoryDelete = (id: string) => {
    // Find the category being deleted
    const categoryToDelete = categories.find((cat) => cat.id === id);
    if (!categoryToDelete) return;

    // Save a copy of the category for undo
    const deletedCategory = { ...categoryToDelete };

    // Delete the category
    const updated = deleteCategory(categories, id);
    setCategories(updated);
    handleReprocessTransactions();

    // Show undo toast
    toast.success(`Deleted "${deletedCategory.name}"`, {
      action: {
        label: "Undo",
        onClick: () => {
          // Restore the category by adding it back
          setCategories((current) => {
            const restored = [...current, deletedCategory];
            saveCategories(restored);
            return restored;
          });
          handleReprocessTransactions();
          toast.success(`Restored "${deletedCategory.name}"`);
        },
      },
      duration: 10000,
    });
  };

  const handleCategoryReorder = (activeId: string, overId: string) => {
    const updated = reorderCategories(categories, activeId, overId);
    setCategories(updated);
  };

  const handleReset = () => {
    setCurrentStep("upload");
    setTransactions([]);
    setUploadedFiles([]);
    setErrors([]);
  };

  // Get categorization summary
  const summary = getCategorizationSummary(transactions);
  const conflictTransactions = transactions.filter((t) => t.isConflict);
  const unassignedTransactions = transactions.filter(
    (t) => !t.categoryId && !t.isConflict
  );
  const canViewResults = summary.categorized > 0 && summary.conflicts === 0 && summary.unassigned === 0;

  return (
    <>
      <Toaster position="bottom-right" richColors />
      <div className="container mx-auto py-8 max-w-7xl">
        <header className="mb-8">
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight mb-2">Bank Transaction Categorizer</h1>
          <p className="text-xl text-muted-foreground">
            Local-first, secure transaction categorization
          </p>
        </header>

      {errors.length > 0 && (
        <Alert variant="destructive" className="mb-6">
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

      <Tabs value={currentStep} onValueChange={(value) => setCurrentStep(value as WizardStep)}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="upload">
            1. Upload Files
          </TabsTrigger>
          <TabsTrigger value="resolve" disabled={transactions.length === 0}>
            2. Resolve Issues
            {summary.total > 0 && (
              <span className="ml-2 text-xs">
                ({summary.conflicts + summary.unassigned} issues)
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!canViewResults}>
            3. View Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FileUpload
              onFilesSelected={setUploadedFiles}
              onProcess={handleProcessFiles}
              isProcessing={isProcessing}
            />
            <CategoryManager
              categories={categories}
              onCategoryAdd={handleCategoryAdd}
              onCategoryUpdate={handleCategoryUpdate}
              onCategoryDelete={handleCategoryDelete}
              onCategoryReorder={handleCategoryReorder}
            />
          </div>
        </TabsContent>

        <TabsContent value="resolve" className="space-y-6">
          {summary.total > 0 && (
            <Alert>
              <AlertDescription>
                <strong>Processing Summary:</strong> {summary.categorized}{" "}
                categorized, {summary.conflicts} conflicts, {summary.unassigned}{" "}
                unassigned
              </AlertDescription>
            </Alert>
          )}

          {conflictTransactions.length > 0 && (
            <ConflictResolver
              conflictTransactions={conflictTransactions}
              categories={categories}
              onResolve={handleResolveConflict}
            />
          )}

          {unassignedTransactions.length > 0 && (
            <UnassignedList
              unassignedTransactions={unassignedTransactions}
              categories={categories}
              onAddKeyword={handleAddKeyword}
              onCreateCategory={handleCreateCategory}
              onReprocess={handleReprocessTransactions}
            />
          )}

          {canViewResults && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                All transactions have been categorized! Click on the &quot;View
                Results&quot; tab to see your categorized transactions.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleReset}>
              Start Over
            </Button>
            <Button
              onClick={() => setCurrentStep("results")}
              disabled={!canViewResults}
            >
              View Results
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <ResultsView transactions={transactions} categories={categories} />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep("resolve")}>
              Back to Issues
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Start Over
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
