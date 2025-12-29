"use client";

import { useState, useRef } from "react";
import Image from "next/image";
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
import { Upload, FileSpreadsheet, X, Loader2, CheckCircle2, AlertTriangle, HelpCircle, Info } from "lucide-react";
import { UploadedFile } from "@/lib/types";
import { detectBankFromContents, detectBankFromFilename, validateFileForBank, BankType } from "@/lib/bankDetection";

const BANK_OPTIONS = [
  { value: "CIBC", label: "CIBC", logo: "/logos/cibc.png" },
  { value: "AMEX", label: "AMEX", logo: "/logos/amex.png" },
] as const;

interface FileUploadProps {
  onFilesSelected: (files: UploadedFile[]) => void;
}

export function FileUpload({
  onFilesSelected,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;

    setIsAnalyzing(true);

    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(fileList)) {
      // Try content-based detection first
      const contentResult = await detectBankFromContents(file);

      // If content detection is confident, use it
      if (contentResult.confidence === "high" || contentResult.confidence === "medium") {
        newFiles.push({
          file,
          bankType: contentResult.bankType,
          detectionConfidence: contentResult.confidence,
          detectionReason: contentResult.reason,
          isManuallySet: false,
        });
      } else {
        // Fall back to filename detection
        const filenameType = detectBankFromFilename(file.name);
        if (filenameType !== "UNKNOWN") {
          newFiles.push({
            file,
            bankType: filenameType,
            detectionConfidence: "low",
            detectionReason: "Detected from filename pattern",
            isManuallySet: false,
          });
        } else {
          // Could not detect - require manual selection
          newFiles.push({
            file,
            bankType: "UNKNOWN",
            detectionConfidence: "none",
            detectionReason: contentResult.reason || "Could not determine bank type",
            isManuallySet: false,
          });
        }
      }
    }

    setIsAnalyzing(false);

    const updated = [...files, ...newFiles];
    setFiles(updated);
    onFilesSelected(updated);
  };

  const updateFileBankType = async (index: number, bankType: BankType) => {
    const file = files[index];

    // Validate the file for the selected bank type
    const validation = await validateFileForBank(file.file, bankType);

    const updated = files.map((f, i) =>
      i === index
        ? {
            ...f,
            bankType,
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

  const hasUnknownFiles = files.some((f) => f.bankType === "UNKNOWN");
  const hasValidationErrors = files.some((f) => f.validationErrors && f.validationErrors.length > 0);

  const getConfidenceIcon = (file: UploadedFile) => {
    // Show error icon if there are validation errors
    if (file.validationErrors && file.validationErrors.length > 0) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (file.isManuallySet && file.bankType !== "UNKNOWN") {
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
                        value={uploadedFile.bankType}
                        onValueChange={(value) => updateFileBankType(index, value as BankType)}
                      >
                        <SelectTrigger className={`w-[130px] h-8 ${uploadedFile.bankType === "UNKNOWN" || hasErrors ? "border-destructive" : ""}`}>
                          <SelectValue>
                            {uploadedFile.bankType === "UNKNOWN" ? (
                              <span className="text-muted-foreground">Unknown</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Image
                                  src={BANK_OPTIONS.find(b => b.value === uploadedFile.bankType)?.logo || ""}
                                  alt={uploadedFile.bankType}
                                  width={16}
                                  height={16}
                                  className="h-4 w-auto"
                                />
                                <span>{uploadedFile.bankType}</span>
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {BANK_OPTIONS.map((bank) => (
                            <SelectItem key={bank.value} value={bank.value}>
                              <div className="flex items-center gap-2">
                                <Image
                                  src={bank.logo}
                                  alt={bank.label}
                                  width={16}
                                  height={16}
                                  className="h-4 w-auto"
                                />
                                <span>{bank.label}</span>
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
                      <p className="font-medium text-destructive mb-1">File doesn&apos;t match {uploadedFile.bankType} format:</p>
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
                </div>
              );
            })}
          </div>
        )}

        {(hasUnknownFiles || hasValidationErrors) && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">
              {hasUnknownFiles && hasValidationErrors
                ? "Please select a bank for each file and fix validation errors before processing."
                : hasUnknownFiles
                ? "Please select a bank for each file before processing."
                : "Please fix file validation errors before processing."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
