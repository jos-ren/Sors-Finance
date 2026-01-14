"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import type { ColumnMapping, ColumnDetectionResult } from "@/lib/parsers/types";
import { detectColumns } from "@/lib/parsers/column-detection";
import { getCellString } from "@/lib/parsers/utils";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

interface ColumnMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: unknown[][];
  fileName: string;
  onConfirm: (mapping: ColumnMapping) => void;
}

const DATE_FORMATS = [
  { value: "ISO", label: "YYYY-MM-DD (2024-01-15)" },
  { value: "MDY", label: "MM/DD/YYYY (01/15/2024)" },
  { value: "DMY", label: "DD/MM/YYYY (15/01/2024)" },
  { value: "DMonY", label: "DD Mon YYYY (15 Jan 2024)" },
  { value: "MonDY", label: "Mon DD, YYYY (Jan 15, 2024)" },
];

export function ColumnMappingDialog({
  open,
  onOpenChange,
  rows,
  fileName,
  onConfirm,
}: ColumnMappingDialogProps) {
  const [hasHeaders, setHasHeaders] = useState(true);
  const [dateColumn, setDateColumn] = useState<number | null>(null);
  const [dateFormat, setDateFormat] = useState<string | undefined>(undefined);
  const [descriptionColumn, setDescriptionColumn] = useState<number | null>(null);
  const [amountInColumn, setAmountInColumn] = useState<number | null>(null);
  const [amountOutColumn, setAmountOutColumn] = useState<number | null>(null);
  const [matchFieldColumns, setMatchFieldColumns] = useState<number[]>([]);
  const [detection, setDetection] = useState<ColumnDetectionResult | null>(null);

  // Auto-detect columns when dialog opens
  useEffect(() => {
    if (open && rows.length > 0) {
      const detected = detectColumns(rows);
      setDetection(detected);

      // Apply detected values
      setHasHeaders(detected.hasHeaders);
      setDateFormat(detected.dateFormat);

      if (detected.dateColumn) {
        setDateColumn(detected.dateColumn.index);
      }

      if (detected.descriptionColumn) {
        setDescriptionColumn(detected.descriptionColumn.index);
        // Default match field to description column
        setMatchFieldColumns([detected.descriptionColumn.index]);
      }

      if (detected.amountInColumn) {
        setAmountInColumn(detected.amountInColumn.index);
      }

      if (detected.amountOutColumn) {
        setAmountOutColumn(detected.amountOutColumn.index);
      }
    }
  }, [open, rows]);

  // Get column count
  const columnCount = rows.length > 0 ? Math.max(...rows.map((r) => (Array.isArray(r) ? r.length : 0))) : 0;

  // Get column headers (either first row or "Column N")
  const getColumnLabel = (index: number): string => {
    if (hasHeaders && rows.length > 0) {
      const headerRow = rows[0];
      const header = getCellString(headerRow, index);
      return header || `Column ${index + 1}`;
    }
    return `Column ${index + 1}`;
  };

  // Get preview rows (first 5 data rows)
  const getPreviewRows = (): unknown[][] => {
    const startRow = hasHeaders ? 1 : 0;
    return rows.slice(startRow, startRow + 5);
  };

  // Get confidence badge for detection
  const getConfidenceBadge = (confidence?: "high" | "medium" | "low") => {
    if (!confidence) return null;

    const colors = {
      high: "bg-green-500/10 text-green-700 dark:text-green-400",
      medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
      low: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    };

    return (
      <Badge variant="secondary" className={colors[confidence]}>
        {confidence} confidence
      </Badge>
    );
  };

  // Validate mapping
  const validateMapping = (): string | null => {
    if (dateColumn === null) return "Please select a date column";
    if (descriptionColumn === null) return "Please select a description column";
    if (amountInColumn === null) return "Please select an amount in column";
    if (amountOutColumn === null) return "Please select an amount out column";

    return null;
  };

  // Handle form submission
  const handleConfirm = () => {
    const error = validateMapping();
    if (error) {
      toast.error(error);
      return;
    }

    const mapping: ColumnMapping = {
      dateColumn: dateColumn!,
      dateFormat,
      descriptionColumn: descriptionColumn!,
      amountInColumn: amountInColumn!,
      amountOutColumn: amountOutColumn!,
      matchFieldColumns: matchFieldColumns.length > 0 ? matchFieldColumns : undefined,
      hasHeaders,
      useNegativeForOut: amountInColumn === amountOutColumn,
    };

    onConfirm(mapping);
    onOpenChange(false);
  };

  // Toggle match field column
  const toggleMatchFieldColumn = (colIndex: number) => {
    setMatchFieldColumns((prev) => {
      if (prev.includes(colIndex)) {
        return prev.filter((c) => c !== colIndex);
      } else {
        return [...prev, colIndex].sort((a, b) => a - b);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Column Mapping</DialogTitle>
          <DialogDescription>
            Map the columns in <strong>{fileName}</strong> to the required transaction fields. We've auto-detected
            likely mappings - review and adjust as needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Headers Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="headers-toggle">First row contains headers</Label>
              <p className="text-sm text-muted-foreground">
                Turn this off if your file doesn't have column headers
              </p>
            </div>
            <Switch id="headers-toggle" checked={hasHeaders} onCheckedChange={setHasHeaders} />
          </div>

          {/* CSV Preview */}
          <div className="space-y-2">
            <Label>Data Preview (first 5 rows)</Label>
            <div className="border rounded-lg overflow-auto max-h-60">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Array.from({ length: columnCount }).map((_, i) => (
                      <TableHead key={i} className="min-w-[120px]">
                        {getColumnLabel(i)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getPreviewRows().map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {Array.from({ length: columnCount }).map((_, colIndex) => (
                        <TableCell key={colIndex} className="font-mono text-sm">
                          {getCellString(row, colIndex) || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Column Mapping */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Column Mapping</Label>

            {/* Date Column */}
            <div className="grid grid-cols-[1fr_2fr] gap-4 items-start">
              <div className="space-y-1">
                <Label htmlFor="date-column" className="flex items-center gap-2">
                  Date Column <span className="text-destructive">*</span>
                  {detection?.dateColumn && getConfidenceBadge(detection.dateColumn.confidence)}
                </Label>
                {detection?.dateColumn?.reason && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5" />
                    {detection.dateColumn.reason}
                  </p>
                )}
              </div>
              <Select
                value={dateColumn !== null ? dateColumn.toString() : undefined}
                onValueChange={(v) => setDateColumn(parseInt(v))}
              >
                <SelectTrigger id="date-column">
                  <SelectValue placeholder="Select date column" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: columnCount }).map((_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {getColumnLabel(i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Format */}
            {dateColumn !== null && (
              <div className="grid grid-cols-[1fr_2fr] gap-4 items-start">
                <Label htmlFor="date-format">Date Format</Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger id="date-format">
                    <SelectValue placeholder="Auto-detect" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((fmt) => (
                      <SelectItem key={fmt.value} value={fmt.value}>
                        {fmt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Description Column */}
            <div className="grid grid-cols-[1fr_2fr] gap-4 items-start">
              <div className="space-y-1">
                <Label htmlFor="description-column" className="flex items-center gap-2">
                  Description Column <span className="text-destructive">*</span>
                  {detection?.descriptionColumn && getConfidenceBadge(detection.descriptionColumn.confidence)}
                </Label>
                {detection?.descriptionColumn?.reason && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5" />
                    {detection.descriptionColumn.reason}
                  </p>
                )}
              </div>
              <Select
                value={descriptionColumn !== null ? descriptionColumn.toString() : undefined}
                onValueChange={(v) => setDescriptionColumn(parseInt(v))}
              >
                <SelectTrigger id="description-column">
                  <SelectValue placeholder="Select description column" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: columnCount }).map((_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {getColumnLabel(i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount Out Column */}
            <div className="grid grid-cols-[1fr_2fr] gap-4 items-start">
              <div className="space-y-1">
                <Label htmlFor="amount-out-column" className="flex items-center gap-2">
                  Amount Out Column <span className="text-destructive">*</span>
                  {detection?.amountOutColumn && getConfidenceBadge(detection.amountOutColumn.confidence)}
                </Label>
                {detection?.amountOutColumn?.reason && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5" />
                    {detection.amountOutColumn.reason}
                  </p>
                )}
              </div>
              <Select
                value={amountOutColumn !== null ? amountOutColumn.toString() : undefined}
                onValueChange={(v) => setAmountOutColumn(parseInt(v))}
              >
                <SelectTrigger id="amount-out-column">
                  <SelectValue placeholder="Select amount out column" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: columnCount }).map((_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {getColumnLabel(i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount In Column */}
            <div className="grid grid-cols-[1fr_2fr] gap-4 items-start">
              <div className="space-y-1">
                <Label htmlFor="amount-in-column" className="flex items-center gap-2">
                  Amount In Column <span className="text-destructive">*</span>
                  {detection?.amountInColumn && getConfidenceBadge(detection.amountInColumn.confidence)}
                </Label>
                {detection?.amountInColumn?.reason && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5" />
                    {detection.amountInColumn.reason}
                  </p>
                )}
              </div>
              <Select
                value={amountInColumn !== null ? amountInColumn.toString() : undefined}
                onValueChange={(v) => setAmountInColumn(parseInt(v))}
              >
                <SelectTrigger id="amount-in-column">
                  <SelectValue placeholder="Select amount in column" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: columnCount }).map((_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {getColumnLabel(i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Same column warning/info */}
            {amountInColumn !== null && amountOutColumn !== null && amountInColumn === amountOutColumn && (
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">Same column for in and out</p>
                  <p className="text-blue-700 dark:text-blue-300">
                    Positive values will be treated as money in, negative values as money out.
                  </p>
                </div>
              </div>
            )}

            {/* Match Field Columns */}
            <div className="grid grid-cols-[1fr_2fr] gap-4 items-start pt-4 border-t">
              <div className="space-y-1">
                <Label>Match Field Columns (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Used for keyword categorization. Defaults to description if not set. Select multiple columns to
                  concatenate them.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: columnCount }).map((_, i) => {
                  const isSelected = matchFieldColumns.includes(i);
                  return (
                    <Button
                      key={i}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleMatchFieldColumn(i)}
                      className={isSelected ? "bg-primary" : ""}
                    >
                      {isSelected && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {getColumnLabel(i)}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm Mapping</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
