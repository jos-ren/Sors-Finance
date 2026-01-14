"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Upload, FileSpreadsheet, X, Loader2, CheckCircle2, AlertTriangle, HelpCircle, Info, Settings } from "lucide-react";
import { UploadedFile } from "@/lib/types";
import { detectBank, validateFile, getAllBankMeta } from "@/lib/parsers";
import { readFileToRows } from "@/lib/parsers/utils";
import { ColumnMappingDialog } from "./ColumnMappingDialog";
import type { ColumnMapping } from "@/lib/parsers/types";

// Bank logos mapping (add new banks here as they are added)
const BANK_LOGOS: Record<string, string> = {
  CIBC: "/logos/cibc.png",
  AMEX: "/logos/amex.png",
};

interface FileUploadProps {
  onFilesSelected: (files: UploadedFile[]) => void;
}

export function FileUpload({
  onFilesSelected,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [mappingFileIndex, setMappingFileIndex] = useState<number | null>(null);
  const [mappingRows, setMappingRows] = useState<unknown[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get all available bank options from the registry
  const bankOptions = useMemo(() => {
    return getAllBankMeta().map(meta => ({
      id: meta.id,
      name: meta.name,
      logo: BANK_LOGOS[meta.id] || null,
    }));
  }, []);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;

    setIsAnalyzing(true);

    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(fileList)) {
      // Detect bank using the registry
      const detection = await detectBank(file);

      newFiles.push({
        file,
        bankId: detection.bankId,
        detectionConfidence: detection.confidence,
        detectionReason: detection.reason,
        isManuallySet: false,
      });
    }

    setIsAnalyzing(false);

    const updated = [...files, ...newFiles];
    setFiles(updated);
    onFilesSelected(updated);
  };

  const updateFileBankType = async (index: number, bankId: string) => {
    const file = files[index];

    // Validate the file for the selected bank type
    const validation = await validateFile(file.file, bankId);

    const updated = files.map((f, i) =>
      i === index
        ? {
            ...f,
            bankId,
            isManuallySet: true,
            detectionConfidence: validation.isValid ? "high" as const : "none" as const,
            detectionReason: validation.isValid ? "Manually selected" : "Validation failed",
            validationErrors: validation.errors,
            validationWarnings: validation.warnings,
          }
        : f
    );
    setFiles(updated);
    onFilesSelected(updated);
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onFilesSelected(updated);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const hasUnknownFiles = files.some((f) => f.bankId === null);
  const hasUnconfiguredCustomFiles = files.some((f) => f.bankId === "CUSTOM" && !f.mappingConfigured);
  const hasValidationErrors = files.some((f) => f.validationErrors && f.validationErrors.length > 0);

  const getConfidenceIcon = (file: UploadedFile) => {
    // Show error icon if there are validation errors
    if (file.validationErrors && file.validationErrors.length > 0) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (file.isManuallySet && file.bankId !== null) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    switch (file.detectionConfidence) {
      case "high":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "medium":
        return <CheckCircle2 className="h-4 w-4 text-yellow-500" />;
      case "low":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <HelpCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getBankOption = (bankId: string | null) => {
    if (!bankId) return null;
    return bankOptions.find(b => b.id === bankId);
  };

  const handleConfigureMapping = async (index: number) => {
    const file = files[index];

    try {
      setIsAnalyzing(true);
      const rows = await readFileToRows(file.file);
      setMappingRows(rows);
      setMappingFileIndex(index);
      setMappingDialogOpen(true);
    } catch (error) {
      console.error("Error reading file:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMappingConfirm = (mapping: ColumnMapping) => {
    if (mappingFileIndex === null) return;

    const updated = files.map((f, i) =>
      i === mappingFileIndex
        ? {
            ...f,
            columnMapping: mapping,
            mappingConfigured: true,
            detectionConfidence: "high" as const,
            detectionReason: "Custom mapping configured",
            validationErrors: [],
            validationWarnings: [],
          }
        : f
    );

    setFiles(updated);
    onFilesSelected(updated);
    setMappingDialogOpen(false);
    setMappingFileIndex(null);
  };

  return (
    <Card className="flex flex-col min-h-0">
      <CardHeader className="flex-shrink-0">
        <CardTitle>Upload Bank Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 overflow-y-auto min-h-0">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors
            ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-ring"}
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mx-auto h-12 w-12 text-muted-foreground animate-spin" />
              <p className="mt-2 text-sm text-foreground">
                Analyzing file contents...
              </p>
            </>
          ) : (
            <>
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-foreground">
                Drag & drop files here, or click to select
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Accepts CSV and Excel files (.csv, .xlsx, .xls)
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.xlsx,.xls"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <div className="space-y-1">
              <h3 className="font-medium text-sm">Uploaded Files</h3>
              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                If your bank isn&apos;t listed, remove the file. Additional banks will be supported in future updates. Optionally consider opening a PR on github to add a missing bank format!
              </p>
            </div>
            {files.map((uploadedFile, index) => {
              const hasErrors = uploadedFile.validationErrors && uploadedFile.validationErrors.length > 0;
              const hasWarnings = uploadedFile.validationWarnings && uploadedFile.validationWarnings.length > 0;

              return (
                <div key={index} className="space-y-2">
                  <div
                    className={`flex items-center justify-between p-3 bg-card border rounded-lg gap-3 ${hasErrors ? "border-destructive" : ""}`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <FileSpreadsheet className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {uploadedFile.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(uploadedFile.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center">
                              {getConfidenceIcon(uploadedFile)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{uploadedFile.detectionReason || "Detection status"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <Select
                        value={uploadedFile.bankId || ""}
                        onValueChange={(value) => updateFileBankType(index, value)}
                      >
                        <SelectTrigger className={`w-[130px] h-8 ${uploadedFile.bankId === null || hasErrors ? "border-destructive" : ""}`}>
                          <SelectValue>
                            {uploadedFile.bankId === null ? (
                              <span className="text-muted-foreground">Unknown</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                {getBankOption(uploadedFile.bankId)?.logo && (
                                  <img
                                    src={getBankOption(uploadedFile.bankId)!.logo!}
                                    alt={uploadedFile.bankId}
                                    className="h-4 w-auto object-contain"
                                  />
                                )}
                                <span>{getBankOption(uploadedFile.bankId)?.name || uploadedFile.bankId}</span>
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {bankOptions.map((bank) => (
                            <SelectItem key={bank.id} value={bank.id}>
                              <div className="flex items-center gap-2">
                                {bank.logo && (
                                  <img
                                    src={bank.logo}
                                    alt={bank.name}
                                    className="h-4 w-auto object-contain"
                                  />
                                )}
                                <span>{bank.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Validation Errors */}
                  {hasErrors && (
                    <div className="ml-8 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm">
                      <p className="font-medium text-destructive mb-1">File doesn&apos;t match {getBankOption(uploadedFile.bankId)?.name || uploadedFile.bankId} format:</p>
                      <ul className="list-disc list-inside text-destructive text-xs space-y-0.5">
                        {uploadedFile.validationErrors!.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground mt-2">
                        Select a different bank or remove this file.
                      </p>
                    </div>
                  )}

                  {/* Validation Warnings */}
                  {!hasErrors && hasWarnings && (
                    <div className="ml-8 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm">
                      <ul className="list-disc list-inside text-yellow-600 dark:text-yellow-500 text-xs space-y-0.5">
                        {uploadedFile.validationWarnings!.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Configure Mapping for CUSTOM bank type */}
                  {uploadedFile.bankId === "CUSTOM" && !uploadedFile.mappingConfigured && (
                    <div className="ml-8 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">Column Mapping Required</p>
                          <p className="text-xs text-muted-foreground">
                            Configure how columns in your file map to transaction fields
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleConfigureMapping(index)}
                          className="flex-shrink-0"
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Configure
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Mapping Configured Message */}
                  {uploadedFile.bankId === "CUSTOM" && uploadedFile.mappingConfigured && (
                    <div className="ml-8 p-2 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <p className="text-sm text-green-600 dark:text-green-400">Column mapping configured</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleConfigureMapping(index)}
                      >
                        Edit Mapping
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(hasUnknownFiles || hasUnconfiguredCustomFiles || hasValidationErrors) && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">
              {hasUnknownFiles || hasUnconfiguredCustomFiles
                ? hasValidationErrors
                  ? "Please select a bank for each file, configure custom mappings, and fix validation errors before processing."
                  : hasUnconfiguredCustomFiles
                  ? "Please configure column mapping for custom imports before processing."
                  : "Please select a bank for each file before processing."
                : "Please fix file validation errors before processing."}
            </p>
          </div>
        )}
      </CardContent>

      {/* Column Mapping Dialog */}
      {mappingFileIndex !== null && (
        <ColumnMappingDialog
          open={mappingDialogOpen}
          onOpenChange={setMappingDialogOpen}
          rows={mappingRows}
          fileName={files[mappingFileIndex]?.file.name || ""}
          onConfirm={handleMappingConfirm}
        />
      )}
    </Card>
  );
}
