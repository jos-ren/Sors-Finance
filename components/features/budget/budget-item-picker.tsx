"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, Ban, Inbox, TrendingUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SYSTEM_CATEGORIES } from "@/lib/db/types";
import { useBudgetHierarchy } from "@/hooks/use-budget";
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
  className,
}: {
  value: PickerValue;
  onChange: (value: PickerValue) => void;
  variant?: "input" | "badge";
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const hierarchy = useBudgetHierarchy(false);
  const categories = useCategories();

  const options = useMemo<Option[]>(() => {
    const out: Option[] = [];
    if (hierarchy) {
      const subById = new Map(hierarchy.subcategories.map((s) => [s.id, s]));
      const groupById = new Map(hierarchy.groups.map((g) => [g.id, g]));
      for (const item of hierarchy.items) {
        const sub = subById.get(item.subcategoryId);
        const group = sub ? groupById.get(sub.groupId) : undefined;
        const groupLabel = group && sub ? `${group.name} › ${sub.name}` : "Ungrouped";
        out.push({
          kind: "item",
          id: item.id!,
          name: item.name,
          path: `${group?.name ?? ""} ${sub?.name ?? ""} ${item.name}`.toLowerCase(),
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

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild disabled={disabled}>
        {variant === "badge" ? (
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
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories…"
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
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

          {grouped.length === 0 && filteredSystem.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches</p>
          )}
        </div>
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
