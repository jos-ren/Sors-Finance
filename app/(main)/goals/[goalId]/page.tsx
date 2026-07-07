"use client";

import { use, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Target, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis } from "recharts";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { useTransactions } from "@/hooks";
import { useGoal, updateGoal } from "@/hooks/use-goals";
import { GoalFundMeter } from "@/components/features/budget/goal-fund-meter";
import type { GoalDetail } from "@/lib/budget/types";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const contributionChartConfig = {
  contributed: {
    label: "Contributed",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export default function GoalDetailPage({ params }: { params: Promise<{ goalId: string }> }) {
  const { goalId } = use(params);
  const id = parseInt(goalId, 10);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const fmt = (n: number) => formatAmount(n, currency);
  const fmtShort = (n: number) => formatAmount(n, currency, false);

  const sentinelRef = useSetPageHeader("Goals");
  const goal = useGoal(id, year, month);
  const transactions = useTransactions({ budgetItemId: id });
  const [editOpen, setEditOpen] = useState(false);

  // Cumulative contributed by month for the chart (flat months stay visible).
  const chartData = useMemo(() => {
    if (!goal) return [];
    let running = 0;
    return goal.contributions.map((c) => {
      running += c.amount;
      return {
        label: `${MONTH_NAMES[c.month]} ${c.year}`,
        contributed: running,
      };
    });
  }, [goal]);

  return (
    <div className="space-y-5 p-6">
      <div ref={sentinelRef} />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/goals">Goals</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{goal?.name ?? "Goal"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {!goal ? (
        <DetailSkeleton />
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold">
                <Target className="h-5 w-5 text-primary" />
                {goal.name}
                {!goal.isActive && (
                  <span className="rounded bg-muted px-1.5 text-xs font-normal uppercase text-muted-foreground">
                    archived
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">{goal.groupName}</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <PencilLine className="h-4 w-4" />
              Edit
            </Button>
          </div>

          <Card>
            <CardContent className="space-y-4 p-5">
              <GoalFundMeter
                contributed={goal.contributed}
                spent={goal.spent}
                available={goal.available}
                target={goal.targetAmount}
                requiredPerMonth={goal.requiredPerMonth}
                targetDate={goal.targetDate}
                formatAmount={fmtShort}
                size="lg"
              />
              <div className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                <Readout label="Contributed" value={fmt(goal.contributed)} />
                <Readout label="Spent" value={fmt(goal.spent)} />
                <Readout label="Target" value={goal.targetAmount != null ? fmt(goal.targetAmount) : "—"} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contributions over time</CardTitle>
              <CardDescription>Cumulative amount allocated to this goal each month</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              {chartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No contributions yet — allocate to this goal in your monthly budget.
                </p>
              ) : (
                <ChartContainer config={contributionChartConfig} className="h-[240px] w-full aspect-auto">
                  <AreaChart data={chartData} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => fmtShort(Number(value))}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" formatter={(value) => fmt(Number(value))} />}
                    />
                    <Area
                      dataKey="contributed"
                      type="stepAfter"
                      fill="var(--chart-2)"
                      fillOpacity={0.35}
                      stroke="var(--chart-2)"
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spending from this goal</CardTitle>
              <CardDescription>All transactions linked to this goal</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!transactions ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">Nothing spent from this goal yet.</p>
              ) : (
                <ul className="divide-y">
                  {transactions.map((t) => {
                    const net = t.amountOut - t.amountIn;
                    return (
                      <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{t.description}</p>
                          <p className="text-xs text-muted-foreground">{format(t.date, "MMM d, yyyy")}</p>
                        </div>
                        <span className={cn("shrink-0 text-sm tabular-nums", net < 0 && "text-primary")}>
                          {net < 0 ? `+${fmt(Math.abs(net))}` : fmt(net)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <EditGoalDialog goal={goal} open={editOpen} onOpenChange={setEditOpen} />
        </>
      )}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

function EditGoalDialog({
  goal,
  open,
  onOpenChange,
}: {
  goal: GoalDetail;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(goal.targetAmount != null ? goal.targetAmount.toFixed(2) : "");
  const [date, setDate] = useState<Date | undefined>(goal.targetDate ? new Date(goal.targetDate) : undefined);
  const [saving, setSaving] = useState(false);

  // Re-seed the form when the dialog opens (or the goal refreshes underneath it).
  useEffect(() => {
    if (!open) return;
    setName(goal.name);
    setTarget(goal.targetAmount != null ? goal.targetAmount.toFixed(2) : "");
    setDate(goal.targetDate ? new Date(goal.targetDate) : undefined);
  }, [open, goal]);

  const handleSave = async () => {
    const parsedTarget = parseFloat(target);
    setSaving(true);
    try {
      await updateGoal(goal.id, {
        name: name.trim(),
        targetAmount: isNaN(parsedTarget) ? null : parsedTarget,
        targetDate: date ? date.getTime() : null,
      });
      toast.success("Goal updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update goal");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    setSaving(true);
    try {
      await updateGoal(goal.id, { isActive: !goal.isActive });
      toast.success(goal.isActive ? "Goal archived" : "Goal restored");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update goal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit goal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-goal-name">Name</Label>
            <Input id="edit-goal-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-goal-target">Target amount</Label>
              <CurrencyInput id="edit-goal-target" value={target} onChange={setTarget} placeholder="5000.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Target date</Label>
              <DatePicker value={date} onChange={setDate} placeholder="No deadline" />
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={handleArchiveToggle} disabled={saving}>
            {goal.isActive ? "Archive" : "Restore"}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-16 w-full max-w-md" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
