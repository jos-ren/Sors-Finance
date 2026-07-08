"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, ChevronDown, Search, Ban, Inbox, TrendingUp, Plus, ArrowLeft, FolderPlus, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SYSTEM_CATEGORIES } from "@/lib/db/types";
import { useBudgetHierarchy, createGroup, createSubcategory } from "@/hooks/use-budget";
import { useCategories } from "@/hooks";

export type PickerValue = { kind: "item" | "system"; id: number } | null;

interface Option {
  kind: "item" | "system";
  id: number;
  name: string;
  /** full searchable path, e.g. "Food › Dining Out › Restaurants" */
  path: string;
  groupLabel: string; // "Group › Sub" for hierarchy, "System" for system rows
}

const SYSTEM_ICON: Record<string, React.ReactNode> = {
  [SYSTEM_CATEGORIES.INCOME]: <TrendingUp className="h-4 w-4 text-primary" />,
  [SYSTEM_CATEGORIES.EXCLUDED]: <Ban className="h-4 w-4 text-muted-foreground" />,
  [SYSTEM_CATEGORIES.UNCATEGORIZED]: <Inbox className="h-4 w-4 text-muted-foreground" />,
};

/**
 * Picker that replaces the flat category Select. Choose a budget item (leaf of
 * the hierarchy) or a system category (Income / Excluded). Value is
 * { kind, id } | null (null = uncategorized). Two trigger variants: an input
 * (dialogs) and a badge (table cells).
 */
export function BudgetItemPicker({
  value,
  onChange,
  variant = "input",
  disabled = false,
  placeholder = "Uncategorized",
  allowCreate = false,
  className,
}: {
  value: PickerValue;
  onChange: (value: PickerValue) => void;
  variant?: "input" | "badge" | "inline";
  disabled?: boolean;
  placeholder?: string;
  /** When true, offer to create a new category (and group) if the typed text has no match. */
  allowCreate?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Create-category sub-view state.
  const [createName, setCreateName] = useState<string | null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const hierarchy = useBudgetHierarchy(false);
  const categories = useCategories();

  const options = useMemo<Option[]>(() => {
    const out: Option[] = [];
    if (hierarchy) {
      const groupById = new Map(hierarchy.groups.map((g) => [g.id, g]));
      for (const category of hierarchy.subcategories) {
        const group = groupById.get(category.groupId);
        const groupLabel = group?.name ?? "Ungrouped";
        out.push({
          kind: "item",
          id: category.id!,
          name: category.name,
          path: `${group?.name ?? ""} ${category.name}`.toLowerCase(),
          groupLabel,
        });
      }
    }
    return out;
  }, [hierarchy]);

  const systemOptions = useMemo<Option[]>(() => {
    return (categories ?? [])
      .filter((c) => c.name === SYSTEM_CATEGORIES.INCOME || c.name === SYSTEM_CATEGORIES.EXCLUDED)
      .map((c) => ({ kind: "system" as const, id: c.id!, name: c.name, path: c.name.toLowerCase(), groupLabel: "System" }));
  }, [categories]);

  const currentLabel = useMemo(() => {
    if (!value) return null;
    const pool = value.kind === "item" ? options : systemOptions;
    return pool.find((o) => o.id === value.id)?.name ?? null;
  }, [value, options, systemOptions]);

  const q = query.trim().toLowerCase();
  const filteredItems = q ? options.filter((o) => o.path.includes(q)) : options;
  const filteredSystem = q ? systemOptions.filter((o) => o.path.includes(q)) : systemOptions;

  // Group items by their "Group › Sub" label for section headers.
  const grouped = useMemo(() => {
    const map = new Map<string, Option[]>();
    for (const o of filteredItems) {
      if (!map.has(o.groupLabel)) map.set(o.groupLabel, []);
      map.get(o.groupLabel)!.push(o);
    }
    return [...map.entries()];
  }, [filteredItems]);

  const select = (v: PickerValue) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  const isSelected = (kind: "item" | "system", id: number) => value?.kind === kind && value.id === id;

  // Offer to create only when there's a query with no exact (case-insensitive) name match.
  const trimmedQuery = query.trim();
  const hasExactMatch =
    trimmedQuery.length > 0 &&
    [...options, ...systemOptions].some((o) => o.name.toLowerCase() === q);
  const showCreate = allowCreate && trimmedQuery.length > 0 && !hasExactMatch;

  const resetCreate = () => {
    setCreateName(null);
    setShowNewGroup(false);
    setNewGroupName("");
  };

  const createUnder = async (groupId: number) => {
    if (createName == null || creating) return;
    setCreating(true);
    try {
      const sub = await createSubcategory(createName.trim(), groupId);
      if (sub?.id != null) select({ kind: "item", id: sub.id });
      resetCreate();
    } finally {
      setCreating(false);
    }
  };

  const createUnderNewGroup = async () => {
    if (!newGroupName.trim() || createName == null || creating) return;
    setCreating(true);
    try {
      const group = await createGroup(newGroupName.trim());
      if (group?.id != null) {
        const sub = await createSubcategory(createName.trim(), group.id);
        if (sub?.id != null) select({ kind: "item", id: sub.id });
      }
      resetCreate();
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQuery(""); resetCreate(); } }}>
      <PopoverTrigger asChild disabled={disabled}>
        {variant === "inline" ? (
          // Seamless underlined field that blends into a sentence.
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "inline-flex max-w-full items-center gap-0.5 border-b border-dashed border-muted-foreground/40 font-semibold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:outline-none",
              !currentLabel && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate">{currentLabel ?? placeholder}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
          </button>
        ) : variant === "badge" ? (
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-accent",
              !currentLabel && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate">{currentLabel ?? placeholder}</span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm shadow-xs hover:bg-accent/40 disabled:opacity-50",
              !currentLabel && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate">{currentLabel ?? placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {createName != null ? (
          // Create-category sub-view: choose a group (or make a new one).
          <div>
            <div className="flex items-center gap-2 border-b px-2 py-2">
              <button
                type="button"
                onClick={resetCreate}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="truncate text-sm">
                Add <span className="font-semibold">{createName}</span> to a group
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {(hierarchy?.groups ?? []).map((g) => (
                <OptionButton key={`group-${g.id}`} selected={false} onClick={() => g.id != null && createUnder(g.id)}>
                  <span className="truncate">{g.name}</span>
                </OptionButton>
              ))}

              {showNewGroup ? (
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") createUnderNewGroup(); }}
                    placeholder="New group name"
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button size="sm" className="h-8" onClick={createUnderNewGroup} disabled={!newGroupName.trim() || creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                </div>
              ) : (
                <OptionButton selected={false} onClick={() => setShowNewGroup(true)}>
                  <FolderPlus className="h-4 w-4 text-muted-foreground" />
                  New group…
                </OptionButton>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={allowCreate ? "Search or type to create…" : "Search categories…"}
                className="h-9 border-0 bg-transparent rounded-none px-0 shadow-none focus-visible:ring-0"
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {/* Clear / Uncategorized */}
              <OptionButton selected={!value} onClick={() => select(null)}>
                <Inbox className="h-4 w-4 text-muted-foreground" />
                Uncategorized
              </OptionButton>

              {grouped.map(([label, items]) => (
                <div key={label} className="pt-1">
                  <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                  {items.map((o) => (
                    <OptionButton key={`item-${o.id}`} selected={isSelected("item", o.id)} onClick={() => select({ kind: "item", id: o.id })}>
                      <span className="truncate">{o.name}</span>
                    </OptionButton>
                  ))}
                </div>
              ))}

              {filteredSystem.length > 0 && (
                <div className="mt-1 border-t pt-1">
                  <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">System</p>
                  {filteredSystem.map((o) => (
                    <OptionButton key={`sys-${o.id}`} selected={isSelected("system", o.id)} onClick={() => select({ kind: "system", id: o.id })}>
                      {SYSTEM_ICON[o.name]}
                      <span className="truncate">{o.name}</span>
                    </OptionButton>
                  ))}
                </div>
              )}

              {showCreate && (
                <div className="mt-1 border-t pt-1">
                  <OptionButton selected={false} onClick={() => { setCreateName(trimmedQuery); setShowNewGroup(false); }}>
                    <Plus className="h-4 w-4 text-primary" />
                    <span className="truncate">Create &ldquo;{trimmedQuery}&rdquo;</span>
                  </OptionButton>
                </div>
              )}

              {grouped.length === 0 && filteredSystem.length === 0 && !showCreate && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches</p>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
        selected && "bg-accent/60"
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}

/** Helper: map a transaction's (categoryId, budgetItemId) to a PickerValue. */
export function toPickerValue(categoryId: number | null, budgetItemId: number | null): PickerValue {
  if (budgetItemId != null) return { kind: "item", id: budgetItemId };
  if (categoryId != null) return { kind: "system", id: categoryId };
  return null;
}

/** Helper: split a PickerValue into the one-FK assignment fields. */
export function fromPickerValue(value: PickerValue): { categoryId: number | null; budgetItemId: number | null } {
  if (!value) return { categoryId: null, budgetItemId: null };
  if (value.kind === "item") return { categoryId: null, budgetItemId: value.id };
  return { categoryId: value.id, budgetItemId: null };
}
