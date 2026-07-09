"use client";

import { useMemo, useState } from "react";
import { X, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useCategories,
  updateCategory,
  invalidateCategories,
  invalidateTransactions,
} from "@/hooks";
import { useBudgetHierarchy, updateSubcategory, deleteSubcategory } from "@/hooks/use-budget";
import { SYSTEM_CATEGORIES, type DbCategory } from "@/lib/db/types";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { SettingsBreadcrumb, SettingsPageHeader, SectionHeader } from "@/components/features/settings/settings-shared";

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
function matchesQuery(keywords: string[], query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return keywords.some((k) => k.toLowerCase().includes(q));
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
    const countMatches = (keywords: string[]) => keywords.filter((k) => k.toLowerCase().includes(q)).length;
    return (
      visibleSystem.reduce((sum, c) => sum + countMatches(c.category.keywords ?? []), 0) +
      visibleGroups.reduce((sum, g) => sum + g.subcategories.reduce((s, sub) => s + countMatches(sub.keywords ?? []), 0), 0)
    );
  }, [visibleSystem, visibleGroups, query]);

  const hasAnyMatch = !query || visibleSystem.length > 0 || visibleGroups.length > 0;

  return (
    <div className="space-y-8 overflow-x-hidden p-6">
      <div ref={sentinelRef} className="h-0" />
      <SettingsBreadcrumb page="Keywords" />
      <SettingsPageHeader
        title="Keywords"
        description="Manage auto-categorization keywords for every category — system categories and your own budget categories."
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
              <SubcategoryCard key={sub.id} id={sub.id!} name={sub.name} keywords={sub.keywords ?? []} query={query} />
            ))}
          </div>
        </section>
      ))}

      {!hasAnyMatch && (
        <p className="text-sm text-muted-foreground">No categories have a keyword matching &quot;{query}&quot;.</p>
      )}
    </div>
  );
}

interface KeywordCardProps {
  name: string;
  keywords: string[];
  description?: string;
  editable?: boolean;
  persist: (next: string[]) => Promise<void>;
  onDelete?: () => void;
  query?: string;
}

function KeywordCard({ name, keywords: initialKeywords, description, editable = true, persist, onDelete, query = "" }: KeywordCardProps) {
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [input, setInput] = useState("");

  const save = async (next: string[]) => {
    const prev = keywords;
    setKeywords(next);
    try {
      await persist(next);
    } catch {
      toast.error("Failed to update keywords");
      setKeywords(prev);
    }
  };

  const add = () => {
    const kw = input.trim();
    if (kw && !keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
      save([...keywords, kw]);
    }
    setInput("");
  };

  return (
    <Card>
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
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="gap-1">
                {highlightMatch(kw, query)}
                <button onClick={() => save(keywords.filter((k) => k !== kw))} aria-label={`Remove ${kw}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {keywords.length === 0 && <span className="text-xs text-muted-foreground">No keywords yet</span>}
          </div>
          <div className="flex gap-2">
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
}: {
  id: number;
  name: string;
  keywords: string[];
  description?: string;
  editable: boolean;
  query?: string;
}) {
  return (
    <KeywordCard
      name={name}
      keywords={keywords}
      description={description}
      editable={editable}
      query={query}
      persist={async (next) => {
        await updateCategory(id, { keywords: next });
        invalidateCategories();
        invalidateTransactions();
      }}
    />
  );
}

function SubcategoryCard({ id, name, keywords, query }: { id: number; name: string; keywords: string[]; query?: string }) {
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
