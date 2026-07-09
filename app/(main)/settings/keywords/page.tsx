"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Plus, Search, Trash2, Loader2, TriangleAlert, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MODE_SPECIFICITY } from "@/lib/categories/keyword";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCategories,
  updateCategory,
  deleteAllKeywords,
  invalidateCategories,
  invalidateTransactions,
} from "@/hooks";
import { useBudgetHierarchy, updateSubcategory, deleteSubcategory } from "@/hooks/use-budget";
import { SYSTEM_CATEGORIES, type DbCategory, type Keyword, type KeywordMatchMode } from "@/lib/db/types";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { SettingsBreadcrumb, SettingsPageHeader, SectionHeader } from "@/components/features/settings/settings-shared";

const MATCH_MODE_LABELS: Record<KeywordMatchMode, string> = {
  contains: "Contains",
  startsWith: "Starts with",
  exact: "Exact match",
};

const MODE_ORDER: KeywordMatchMode[] = ["contains", "startsWith", "exact"];

const SYSTEM_DESCRIPTIONS: Record<string, string> = {
  [SYSTEM_CATEGORIES.INCOME]: "Transactions matching these keywords are counted as income (drives Available to Assign).",
  [SYSTEM_CATEGORIES.EXCLUDED]: "Transactions matching these keywords are ignored (e.g. transfers between your own accounts).",
  [SYSTEM_CATEGORIES.UNCATEGORIZED]: "Fallback for transactions with no keyword match. No keywords needed.",
};

/**
 * Settings → Keywords. Manages auto-categorization keywords for every
 * category: the 3 built-in system categories (Uncategorized, Excluded,
 * Income) plus every user-made category from the budget hierarchy, grouped
 * by Category Group.
 */
function matchesQuery(keywords: Keyword[], query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return keywords.some((k) => k.text.toLowerCase().includes(q));
}

/** One category/subcategory's contribution to the cross-category keyword index. */
interface KeywordOwner {
  ownerId: string;
  name: string;
  keywords: Keyword[];
}

/** text (lowercased) → every owner using that exact text, with its mode. */
type KeywordIndex = Map<string, Array<{ ownerId: string; name: string; mode: KeywordMatchMode }>>;

function buildKeywordIndex(owners: KeywordOwner[]): KeywordIndex {
  const index: KeywordIndex = new Map();
  for (const owner of owners) {
    for (const kw of owner.keywords) {
      const key = kw.text.trim().toLowerCase();
      if (!key) continue;
      const entries = index.get(key) ?? [];
      entries.push({ ownerId: owner.ownerId, name: owner.name, mode: kw.mode });
      index.set(key, entries);
    }
  }
  return index;
}

type KeywordConflict =
  | { kind: "tie"; others: Array<{ name: string; mode: KeywordMatchMode }> }
  | { kind: "shadowed"; others: Array<{ name: string; mode: KeywordMatchMode }> }
  | null;

/**
 * How a keyword instance relates to same-text keywords on OTHER categories.
 * "tie" — another category uses the identical text at the same specificity,
 * so the categorizer can't resolve which one wins (genuine conflict).
 * "shadowed" — another category's identical text has a more specific mode, so
 * it wins on the overlap and this keyword never gets a chance there.
 * `null` — no other owner uses this exact text, or this one is the most
 * specific (no warning needed on this pill).
 */
function classifyKeywordConflict(
  text: string,
  mode: KeywordMatchMode,
  ownerId: string,
  index: KeywordIndex
): KeywordConflict {
  const others = (index.get(text.trim().toLowerCase()) ?? []).filter((e) => e.ownerId !== ownerId);
  if (others.length === 0) return null;

  const mySpec = MODE_SPECIFICITY[mode];
  const maxOtherSpec = Math.max(...others.map((o) => MODE_SPECIFICITY[o.mode]));

  if (maxOtherSpec > mySpec) {
    return { kind: "shadowed", others: others.filter((o) => MODE_SPECIFICITY[o.mode] === maxOtherSpec) };
  }
  if (maxOtherSpec === mySpec) {
    return { kind: "tie", others: others.filter((o) => MODE_SPECIFICITY[o.mode] === mySpec) };
  }
  return null;
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-yellow-200 px-0.5 text-yellow-950 dark:bg-yellow-500/40 dark:text-yellow-100">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function KeywordsSettingsPage() {
  const sentinelRef = useSetPageHeader("Keywords");
  const categories = useCategories();
  const hierarchy = useBudgetHierarchy();
  const [search, setSearch] = useState("");
  const [showWipeKeywordsDialog, setShowWipeKeywordsDialog] = useState(false);
  const [wipeKeywordsConfirmText, setWipeKeywordsConfirmText] = useState("");
  const [isWipingKeywords, setIsWipingKeywords] = useState(false);

  const handleWipeKeywords = async () => {
    if (wipeKeywordsConfirmText !== "DELETE ALL KEYWORDS") {
      toast.error("Please type 'DELETE ALL KEYWORDS' to confirm");
      return;
    }
    setIsWipingKeywords(true);
    try {
      const { cleared } = await deleteAllKeywords();
      toast.success(`Cleared keywords from ${cleared} categor${cleared === 1 ? "y" : "ies"}`);
      setShowWipeKeywordsDialog(false);
      setWipeKeywordsConfirmText("");
    } catch {
      toast.error("Failed to delete keywords");
    } finally {
      setIsWipingKeywords(false);
    }
  };

  const systemByName = useMemo(() => {
    const map = new Map<string, DbCategory>();
    for (const c of categories ?? []) map.set(c.name, c);
    return map;
  }, [categories]);

  const income = systemByName.get(SYSTEM_CATEGORIES.INCOME);
  const excluded = systemByName.get(SYSTEM_CATEGORIES.EXCLUDED);
  const uncategorized = systemByName.get(SYSTEM_CATEGORIES.UNCATEGORIZED);

  const groups = hierarchy?.groups ?? [];
  const subcategories = hierarchy?.subcategories ?? [];
  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.order - b.order), [groups]);

  const query = search.trim();

  const systemEntries = useMemo(
    () => [
      { category: income, editable: true },
      { category: excluded, editable: true },
      { category: uncategorized, editable: false },
    ],
    [income, excluded, uncategorized]
  );

  const visibleSystem = useMemo(
    () =>
      systemEntries.filter(
        (e): e is { category: DbCategory; editable: boolean } => !!e.category && matchesQuery(e.category.keywords ?? [], query)
      ),
    [systemEntries, query]
  );

  const visibleGroups = useMemo(
    () =>
      sortedGroups
        .map((group) => ({
          group,
          subcategories: subcategories
            .filter((s) => s.groupId === group.id && s.isActive && matchesQuery(s.keywords ?? [], query))
            .sort((a, b) => a.order - b.order),
        }))
        .filter((g) => g.subcategories.length > 0),
    [sortedGroups, subcategories, query]
  );

  const totalMatchCount = useMemo(() => {
    if (!query) return 0;
    const q = query.toLowerCase();
    const countMatches = (keywords: Keyword[]) => keywords.filter((k) => k.text.toLowerCase().includes(q)).length;
    return (
      visibleSystem.reduce((sum, c) => sum + countMatches(c.category.keywords ?? []), 0) +
      visibleGroups.reduce((sum, g) => sum + g.subcategories.reduce((s, sub) => s + countMatches(sub.keywords ?? []), 0), 0)
    );
  }, [visibleSystem, visibleGroups, query]);

  const hasAnyMatch = !query || visibleSystem.length > 0 || visibleGroups.length > 0;

  // Cross-category keyword index (unfiltered by search) so conflict warnings
  // stay accurate regardless of what's currently visible.
  const keywordIndex = useMemo(() => {
    const owners: KeywordOwner[] = [];
    for (const { category } of systemEntries) {
      if (category) owners.push({ ownerId: `sys-${category.id}`, name: category.name, keywords: category.keywords ?? [] });
    }
    for (const sub of subcategories) {
      if (sub.isActive) owners.push({ ownerId: `sub-${sub.id}`, name: sub.name, keywords: sub.keywords ?? [] });
    }
    return buildKeywordIndex(owners);
  }, [systemEntries, subcategories]);

  return (
    <div className="space-y-8 overflow-x-hidden p-6">
      <div ref={sentinelRef} className="h-0" />
      <SettingsBreadcrumb page="Keywords" />
      <SettingsPageHeader
        title="Keywords"
        description="Manage auto-categorization keywords for every category — system categories and your own budget categories."
        action={
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowWipeKeywordsDialog(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete All Keywords
          </Button>
        }
      />

      <div className="max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all keywords..."
            className="pl-8"
          />
        </div>
        {query && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {totalMatchCount} keyword{totalMatchCount !== 1 ? "s" : ""} match &quot;{query}&quot;
          </p>
        )}
      </div>

      {visibleSystem.length > 0 && (
        <section className="space-y-2">
          <SectionHeader label="System" />
          <div className="space-y-4">
            {visibleSystem.map(({ category, editable }) => (
              <SystemCategoryCard
                key={category.id}
                id={category.id!}
                name={category.name}
                keywords={category.keywords ?? []}
                description={SYSTEM_DESCRIPTIONS[category.name]}
                editable={editable}
                query={query}
                ownerId={`sys-${category.id}`}
                keywordIndex={keywordIndex}
              />
            ))}
          </div>
        </section>
      )}

      {visibleGroups.map(({ group, subcategories: groupSubcategories }) => (
        <section key={group.id} className="space-y-2">
          <SectionHeader label={group.name} />
          <div className="space-y-4">
            {groupSubcategories.map((sub) => (
              <SubcategoryCard
                key={sub.id}
                id={sub.id!}
                name={sub.name}
                keywords={sub.keywords ?? []}
                query={query}
                ownerId={`sub-${sub.id}`}
                keywordIndex={keywordIndex}
              />
            ))}
          </div>
        </section>
      ))}

      {!hasAnyMatch && (
        <p className="text-sm text-muted-foreground">No categories have a keyword matching &quot;{query}&quot;.</p>
      )}

      <AlertDialog
        open={showWipeKeywordsDialog}
        onOpenChange={(open) => {
          setShowWipeKeywordsDialog(open);
          if (!open) setWipeKeywordsConfirmText("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all keywords?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove every keyword from every category, including system
              categories. Categories, budgets, and existing transaction assignments are kept. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">
                Type <code className="bg-muted px-1 py-0.5 rounded">DELETE ALL KEYWORDS</code> to
                confirm:
              </p>
              <Input
                value={wipeKeywordsConfirmText}
                onChange={(e) => setWipeKeywordsConfirmText(e.target.value)}
                placeholder="Type here..."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWipeKeywordsConfirmText("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleWipeKeywords}
              disabled={wipeKeywordsConfirmText !== "DELETE ALL KEYWORDS" || isWipingKeywords}
            >
              {isWipingKeywords ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete Keywords"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface KeywordCardProps {
  name: string;
  keywords: Keyword[];
  description?: string;
  editable?: boolean;
  persist: (next: Keyword[]) => Promise<void>;
  onDelete?: () => void;
  query?: string;
  ownerId: string;
  keywordIndex: KeywordIndex;
}

function KeywordCard({
  name,
  keywords: initialKeywords,
  description,
  editable = true,
  persist,
  onDelete,
  query = "",
  ownerId,
  keywordIndex,
}: KeywordCardProps) {
  const [keywords, setKeywords] = useState<Keyword[]>(initialKeywords);
  const [input, setInput] = useState("");
  useEffect(() => {
    setKeywords(initialKeywords);
  }, [initialKeywords]);
  const [mode, setMode] = useState<KeywordMatchMode>("contains");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  const save = async (next: Keyword[]) => {
    const prev = keywords;
    setKeywords(next);
    try {
      await persist(next);
    } catch {
      toast.error("Failed to update keywords");
      setKeywords(prev);
    }
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingText(keywords[index].text);
  };

  const cancelEdit = () => setEditingIndex(null);

  const commitEdit = () => {
    if (editingIndex === null) return;
    const index = editingIndex;
    const next = editingText.trim();
    setEditingIndex(null);
    if (!next || next.toLowerCase() === keywords[index].text.toLowerCase()) return;
    if (keywords.some((k, i) => i !== index && k.text.toLowerCase() === next.toLowerCase())) {
      toast.error(`"${next}" is already a keyword here`);
      return;
    }
    save(keywords.map((k, i) => (i === index ? { ...k, text: next } : k)));
  };

  const add = () => {
    const kw = input.trim();
    if (!kw) return;
    if (keywords.some((k) => k.text.toLowerCase() === kw.toLowerCase())) {
      toast.error(`"${kw}" is already a keyword here`);
      return;
    }
    save([...keywords, { text: kw, mode }]);
    setMode("contains");
    setInput("");
  };

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{name}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            aria-label={`Delete ${name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardHeader>
      {editable && (
        <CardContent className="space-y-3">
          {keywords.length === 0 ? (
            <span className="mb-2 block text-xs text-muted-foreground">No keywords yet</span>
          ) : (
            <div className="space-y-4">
              {MODE_ORDER.map((m) => {
                const entries = keywords
                  .map((kw, index) => ({ kw, index }))
                  .filter(({ kw }) => kw.mode === m);
                if (entries.length === 0) return null;
                return (
                  <div key={m} className="space-y-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {MATCH_MODE_LABELS[m]}
                    </p>
                    <TooltipProvider delayDuration={200}>
                      <div className="flex flex-wrap gap-1.5">
                        {entries.map(({ kw, index }) => {
                          const conflict = classifyKeywordConflict(kw.text, kw.mode, ownerId, keywordIndex);
                          const pill = (
                            <Badge
                              key={`${kw.text}-${index}`}
                              variant="secondary"
                              className={cn(
                                "h-6 gap-1 pl-2 pr-1",
                                conflict?.kind === "tie" &&
                                  "border-amber-500/60 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400",
                                conflict?.kind === "shadowed" && "text-muted-foreground/70"
                              )}
                            >
                              {conflict?.kind === "tie" && <TriangleAlert className="h-3 w-3" />}
                              {conflict?.kind === "shadowed" && <EyeOff className="h-3 w-3" />}
                              {editingIndex === index ? (
                                <input
                                  autoFocus
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onBlur={commitEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      commitEdit();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelEdit();
                                    }
                                  }}
                                  className="w-24 bg-transparent text-xs outline-none"
                                  aria-label={`Edit keyword ${kw.text}`}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEdit(index)}
                                  className="cursor-text text-left"
                                  aria-label={`Edit keyword ${kw.text}`}
                                  title="Click to edit"
                                >
                                  {highlightMatch(kw.text, query)}
                                </button>
                              )}
                              <button
                                onClick={() => save(keywords.filter((_, i) => i !== index))}
                                aria-label={`Remove ${kw.text}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );

                          if (!conflict) return pill;

                          const otherNames = conflict.others.map((o) => o.name).join(", ");
                          const tooltip =
                            conflict.kind === "tie"
                              ? `Also used by ${otherNames} at the same precision — matching transactions won't auto-categorize until this is resolved.`
                              : `Overridden by a more specific rule for this exact text on ${otherNames} — matches go there instead.`;

                          return (
                            <Tooltip key={`${kw.text}-${index}`}>
                              <TooltipTrigger asChild>{pill}</TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px]">
                                {tooltip}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </TooltipProvider>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Select value={mode} onValueChange={(v) => setMode(v as KeywordMatchMode)}>
              <SelectTrigger className="w-36 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MATCH_MODE_LABELS) as KeywordMatchMode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MATCH_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="Add keyword, press Enter"
              className="max-w-xs"
            />
            <button
              onClick={add}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 text-sm hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function SystemCategoryCard({
  id,
  name,
  keywords,
  description,
  editable,
  query,
  ownerId,
  keywordIndex,
}: {
  id: number;
  name: string;
  keywords: Keyword[];
  description?: string;
  editable: boolean;
  query?: string;
  ownerId: string;
  keywordIndex: KeywordIndex;
}) {
  return (
    <KeywordCard
      name={name}
      keywords={keywords}
      description={description}
      editable={editable}
      query={query}
      ownerId={ownerId}
      keywordIndex={keywordIndex}
      persist={async (next) => {
        await updateCategory(id, { keywords: next });
        invalidateCategories();
        invalidateTransactions();
      }}
    />
  );
}

function SubcategoryCard({
  id,
  name,
  keywords,
  query,
  ownerId,
  keywordIndex,
}: {
  id: number;
  name: string;
  keywords: Keyword[];
  query?: string;
  ownerId: string;
  keywordIndex: KeywordIndex;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    try {
      const res = await deleteSubcategory(id);
      toast.success(
        res.transactions > 0
          ? `Category deleted · ${res.transactions} transaction(s) uncategorized`
          : "Category deleted"
      );
    } catch {
      toast.error("Failed to delete category");
    }
  };

  return (
    <>
      <KeywordCard
        name={name}
        keywords={keywords}
        query={query}
        ownerId={ownerId}
        keywordIndex={keywordIndex}
        onDelete={() => setConfirmOpen(true)}
        persist={async (next) => {
          await updateSubcategory(id, { keywords: next });
        }}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${name}"?`}
        description="This permanently deletes the category and its planned amounts. Assigned transactions become uncategorized. To keep history, archive it instead."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
