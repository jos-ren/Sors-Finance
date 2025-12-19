"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, X, AlertCircle } from "lucide-react";
import { UploadedFile } from "@/lib/types";

interface FileUploadProps {
  onFilesSelected: (files: UploadedFile[]) => void;
  onProcess: () => void;
  isProcessing: boolean;
}

export function FileUpload({
  onFilesSelected,
  onProcess,
  isProcessing,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectBankType = (fileName: string): "CIBC" | "AMEX" | "UNKNOWN" => {
    const lowerName = fileName.toLowerCase();
    if (lowerName.startsWith("cibc")) return "CIBC";
    if (lowerName.startsWith("summary")) return "AMEX";
    return "UNKNOWN";
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles: UploadedFile[] = Array.from(fileList).map((file) => ({
      file,
      bankType: detectBankType(file.name),
    }));

    const updated = [...files, ...newFiles];
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Bank Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-foreground">
            Drag & drop files here, or click to select
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Accepts CSV and Excel files (.csv, .xlsx, .xls)
          </p>
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
            <h3 className="font-medium text-sm">Uploaded Files</h3>
            {files.map((uploadedFile, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-secondary rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {uploadedFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(uploadedFile.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={
                      uploadedFile.bankType === "UNKNOWN"
                        ? "destructive"
                        : "default"
                    }
                  >
                    {uploadedFile.bankType}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasUnknownFiles && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Some files have unknown bank types. Filenames should start with
              &quot;cibc&quot; or &quot;Summary&quot; for automatic detection.
            </AlertDescription>
          </Alert>
        )}

        {files.length > 0 && (
          <Button
            onClick={onProcess}
            disabled={isProcessing || hasUnknownFiles}
            className="w-full"
          >
            {isProcessing ? "Processing..." : "Process Files"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
