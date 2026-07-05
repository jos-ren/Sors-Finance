"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCategories, updateCategory, invalidateCategories, invalidateTransactions, type DbCategory } from "@/hooks";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { SettingsBreadcrumb, SettingsPageHeader } from "@/components/features/settings/settings-shared";

const DESCRIPTIONS: Record<string, string> = {
  Income: "Transactions matching these keywords are counted as income (drives Available to Assign).",
  Excluded: "Transactions matching these keywords are ignored (e.g. transfers between your own accounts).",
  Uncategorized: "Fallback for transactions with no keyword match. No keywords needed.",
};

/**
 * Settings → Categories, shrunk to system-category keyword management. All
 * budget categorization now lives in the 3-level hierarchy on the Budget page.
 */
export default function CategoriesSettingsPage() {
  const sentinelRef = useSetPageHeader("Categories");
  const categories = useCategories();
  const systemCategories = (categories ?? []).filter((c) => c.isSystem);

  return (
    <div className="space-y-8 overflow-x-hidden p-6">
      <div ref={sentinelRef} className="h-0" />
      <SettingsBreadcrumb page="Categories" />
      <SettingsPageHeader
        title="System Categories"
        description="Keywords for the built-in Income and Excluded categories. Your spending categories live on the Budget page."
      />

      <div className="space-y-4">
        {systemCategories.map((category) => (
          <SystemCategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}

function SystemCategoryCard({ category }: { category: DbCategory }) {
  const [keywords, setKeywords] = useState<string[]>(category.keywords ?? []);
  const [input, setInput] = useState("");
  const editable = category.name !== "Uncategorized";

  const persist = async (next: string[]) => {
    setKeywords(next);
    try {
      await updateCategory(category.id!, { keywords: next });
      invalidateCategories();
      invalidateTransactions();
    } catch {
      toast.error("Failed to update keywords");
    }
  };

  const add = () => {
    const kw = input.trim();
    if (kw && !keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
      persist([...keywords, kw]);
    }
    setInput("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{category.name}</CardTitle>
        <CardDescription>{DESCRIPTIONS[category.name] ?? ""}</CardDescription>
      </CardHeader>
      {editable && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="gap-1">
                {kw}
                <button onClick={() => persist(keywords.filter((k) => k !== kw))} aria-label={`Remove ${kw}`}>
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
