"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Target, Plus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { useGoals, useBudgetHierarchy } from "@/hooks";
import { createGoal } from "@/hooks/use-goals";
import { GoalFundMeter } from "@/components/features/budget/goal-fund-meter";
import type { GoalSummary } from "@/lib/budget/types";

export default function GoalsPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const fmt = useCallback((n: number) => formatAmount(n, currency), [formatAmount, currency]);
  const fmtShort = useCallback((n: number) => formatAmount(n, currency, false), [formatAmount, currency]);

  const sentinelRef = useSetPageHeader("Goals");
  const goals = useGoals(year, month);
  const [dialogOpen, setDialogOpen] = useState(false);

  const active = useMemo(() => (goals ?? []).filter((g) => g.isActive && !g.isComplete), [goals]);
  const completed = useMemo(() => (goals ?? []).filter((g) => g.isComplete), [goals]);

  const totals = useMemo(() => {
    const visible = (goals ?? []).filter((g) => g.isActive);
    return {
      available: visible.reduce((a, g) => a + g.available, 0),
      contributed: visible.reduce((a, g) => a + g.contributed, 0),
      target: visible.reduce((a, g) => a + (g.targetAmount ?? 0), 0),
      count: visible.filter((g) => !g.isComplete).length,
    };
  }, [goals]);

  return (
    <div className="space-y-6 p-6">
      <div ref={sentinelRef} />

      <div className="flex items-center justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Goal
        </Button>
      </div>

      {!goals ? (
        <GoalsSkeleton />
      ) : goals.length === 0 ? (
        <EmptyGoals onCreate={() => setDialogOpen(true)} />
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryStat label="Available across goals" value={fmt(totals.available)} />
            <SummaryStat
              label="Contributed"
              value={totals.target > 0 ? `${fmt(totals.contributed)} of ${fmt(totals.target)}` : fmt(totals.contributed)}
            />
            <SummaryStat label="Active goals" value={String(totals.count)} />
          </div>

          {/* Active goal cards */}
          {active.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No active goals — everything&apos;s reached 🎉
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {active.map((g) => (
                <GoalCard key={g.id} goal={g} fmt={fmtShort} />
              ))}
            </div>
          )}

          {/* Completed goals */}
          {completed.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:-rotate-90" />
                Completed ({completed.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <ul className="divide-y rounded-xl border">
                  {completed.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={`/goals/${g.id}`}
                        className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-accent/50"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          <Target className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="truncate">{g.name}</span>
                          <span className="text-xs text-muted-foreground">{g.groupName}</span>
                        </span>
                        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                          {fmtShort(g.contributed)} saved · <span className="font-medium text-primary">Reached 🎉</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      <NewGoalDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function GoalCard({ goal, fmt }: { goal: GoalSummary; fmt: (n: number) => string }) {
  const toGo = goal.targetAmount != null ? Math.max(0, goal.targetAmount - goal.contributed) : null;
  return (
    <Link href={`/goals/${goal.id}`} className="block">
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Target className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{goal.name}</span>
              </p>
              <p className="text-xs text-muted-foreground">{goal.groupName}</p>
            </div>
          </div>

          <GoalFundMeter
            contributed={goal.contributed}
            spent={goal.spent}
            available={goal.available}
            target={goal.targetAmount}
            requiredPerMonth={goal.requiredPerMonth}
            targetDate={goal.targetDate}
            formatAmount={fmt}
          />

          <p className="text-xs text-muted-foreground tabular-nums">
            {toGo != null && <>{fmt(toGo)} to go</>}
            {goal.thisMonthContributed > 0 && (
              <span className={cn(toGo != null && "ml-2")}>+{fmt(goal.thisMonthContributed)} this month</span>
            )}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyGoals({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <Target className="h-8 w-8 text-muted-foreground" />
      <p className="text-lg font-medium">No goals yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        A goal is a sinking fund: allocate to it each month in your budget, then spend from it when the time comes.
      </p>
      <Button onClick={onCreate}>Create a goal</Button>
    </div>
  );
}

function NewGoalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const hierarchy = useBudgetHierarchy();
  const groups = hierarchy?.groups ?? [];

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [groupId, setGroupId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setTarget("");
    setDate(undefined);
    setGroupId("");
  };

  const handleCreate = async () => {
    const parsedTarget = parseFloat(target);
    setSaving(true);
    try {
      await createGoal({
        name: name.trim(),
        groupId: parseInt(groupId, 10),
        targetAmount: isNaN(parsedTarget) ? null : parsedTarget,
        targetDate: date ? date.getTime() : null,
      });
      toast.success("Goal created");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Failed to create goal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
          <DialogDescription>
            Save toward it by allocating in your monthly budget — contributions accumulate over time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Europe Trip"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Category group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Target amount</Label>
              <CurrencyInput id="goal-target" value={target} onChange={setTarget} placeholder="5000.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Target date (optional)</Label>
              <DatePicker value={date} onChange={setDate} placeholder="No deadline" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim() || !groupId}>
            {saving ? "Creating…" : "Create goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
