"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBudgetHierarchy } from "@/hooks/use-budget";
import { createProject, updateProject } from "@/hooks/use-projects";
import { classifyCategory } from "@/lib/budget/classify";
import type { Keyword, KeywordMatchMode } from "@/lib/db/types";
import type { ProjectInput, ProjectSummary } from "@/lib/projects/types";
import { PROJECT_COLORS, dayToLocalDate, localDateToDay } from "./project-utils";

const NO_FUND = "none";

const MATCH_MODES: { value: KeywordMatchMode; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "startsWith", label: "Starts with" },
  { value: "exact", label: "Exact" },
];

/**
 * Create or edit a project. Without `project` it creates; with it, it edits.
 * `onCreated` receives the new id so callers can navigate to it.
 */
export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectSummary;
  onCreated?: (id: number) => void;
}) {
  const hierarchy = useBudgetHierarchy();
  const funds = useMemo(
    () => (hierarchy?.subcategories ?? []).filter((s) => s.isActive && classifyCategory(s) === "saving"),
    [hierarchy]
  );

  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [budget, setBudget] = useState("");
  const [fundedSeparately, setFundedSeparately] = useState(true);
  const [fundId, setFundId] = useState(NO_FUND);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [keywordText, setKeywordText] = useState("");
  const [keywordMode, setKeywordMode] = useState<KeywordMatchMode>("contains");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Seed the form each time the dialog opens
  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setColor(project?.color ?? PROJECT_COLORS[0]);
    setStart(project ? dayToLocalDate(project.startDate) : undefined);
    setEnd(project ? dayToLocalDate(project.endDate) : undefined);
    setBudget(project?.budget != null ? project.budget.toFixed(2) : "");
    setFundedSeparately(project?.fundedSeparately ?? true);
    setFundId(project?.fundCategoryId != null ? String(project.fundCategoryId) : NO_FUND);
    setKeywords(project?.keywords ?? []);
    setKeywordText("");
    setKeywordMode("contains");
    setNotes(project?.notes ?? "");
  }, [open, project]);

  const endBeforeStart = !!start && !!end && end < start;
  const canSave = !!name.trim() && !!start && !endBeforeStart && !saving;

  const addKeyword = () => {
    const text = keywordText.trim();
    if (!text || keywords.some((k) => k.text.toLowerCase() === text.toLowerCase())) return;
    setKeywords([...keywords, { text, mode: keywordMode }]);
    setKeywordText("");
  };

  const handleSave = async () => {
    if (!start) return;
    const parsedBudget = parseFloat(budget);
    const input: ProjectInput = {
      name: name.trim(),
      color,
      startDate: localDateToDay(start),
      endDate: end ? localDateToDay(end) : null,
      budget: Number.isNaN(parsedBudget) ? null : parsedBudget,
      fundedSeparately,
      fundCategoryId: fundId === NO_FUND ? null : Number(fundId),
      keywords,
      notes: notes.trim() || null,
    };
    setSaving(true);
    try {
      if (project) {
        await updateProject(project.id, input);
        toast.success("Project updated");
      } else {
        const id = await createProject(input);
        toast.success("Project created");
        onCreated?.(id);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            Group transactions from a trip, a move or a big purchase. Each transaction keeps its category.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <div className="flex items-center gap-2">
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Japan trip"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1" role="radiogroup" aria-label="Colour">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform",
                    color === c ? "scale-110 border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <DatePicker value={start} onChange={setStart} placeholder="Pick a date" />
            </div>
            <div className="space-y-1.5">
              <Label>End date (optional)</Label>
              <DatePicker value={end} onChange={setEnd} placeholder="Open-ended" />
              {endBeforeStart && <p className="text-xs text-destructive">End date is before the start date.</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-budget">Budget (optional)</Label>
            <CurrencyInput id="project-budget" value={budget} onChange={setBudget} placeholder="6000.00" />
            <p className="text-xs text-muted-foreground">One total for the whole project.</p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="project-funded">Funded separately</Label>
              <p className="text-xs text-muted-foreground">
                Paid from savings, not this month&apos;s budget. Its spending is left out of your monthly budget and
                shown as its own line. Turn off for small trips your monthly budget already covers.
              </p>
            </div>
            <Switch id="project-funded" checked={fundedSeparately} onCheckedChange={setFundedSeparately} />
          </div>

          <div className="space-y-1.5">
            <Label>Fund (optional)</Label>
            <Select value={fundId} onValueChange={setFundId}>
              <SelectTrigger>
                <SelectValue placeholder="No fund" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FUND}>No fund</SelectItem>
                {funds.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">The saving category you set money aside in for this.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-keyword">Keywords (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="project-keyword"
                value={keywordText}
                onChange={(e) => setKeywordText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="TOKYO"
              />
              <Select value={keywordMode} onValueChange={(v) => setKeywordMode(v as KeywordMatchMode)}>
                <SelectTrigger className="w-[130px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATCH_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addKeyword} disabled={!keywordText.trim()}>
                Add
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {keywords.map((k) => (
                  <span
                    key={k.text}
                    className="inline-flex items-center gap-1 rounded-md border bg-muted/50 py-0.5 pl-2 pr-1 text-xs"
                  >
                    {k.text}
                    {k.mode !== "contains" && (
                      <span className="text-muted-foreground">
                        · {MATCH_MODES.find((m) => m.value === k.mode)?.label}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${k.text}`}
                      onClick={() => setKeywords(keywords.filter((x) => x.text !== k.text))}
                      className="rounded p-0.5 hover:bg-accent"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Imported transactions that match are added automatically, but only between the start and end dates.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-notes">Notes (optional)</Label>
            <Textarea id="project-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving…" : project ? "Save" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
