"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Database, Download, Upload, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useSetPageHeader } from "@/lib/page-header-context";
import {
  SettingsBreadcrumb,
  SettingsPageHeader,
  SectionHeader,
  RowGroup,
  ActionRow,
} from "@/components/settings/SettingsShared";
import { BANK_LOGOS_DISPLAY } from "@/lib/bank-logos";

const DEV_COLORS = [
  { name: "Background", var: "--background", class: "bg-background" },
  { name: "Foreground", var: "--foreground", class: "bg-foreground" },
  { name: "Primary", var: "--primary", class: "bg-primary" },
  { name: "Secondary", var: "--secondary", class: "bg-secondary" },
  { name: "Muted", var: "--muted", class: "bg-muted" },
  { name: "Accent", var: "--accent", class: "bg-accent" },
  { name: "Destructive", var: "--destructive", class: "bg-destructive" },
  { name: "Border", var: "--border", class: "bg-border" },
  { name: "Card", var: "--card", class: "bg-card" },
  { name: "Ring", var: "--ring", class: "bg-ring" },
];

const DEV_CHART_COLORS = [
  { name: "Chart 1", var: "--chart-1", class: "bg-chart-1" },
  { name: "Chart 2", var: "--chart-2", class: "bg-chart-2" },
  { name: "Chart 3", var: "--chart-3", class: "bg-chart-3" },
  { name: "Chart 4", var: "--chart-4", class: "bg-chart-4" },
  { name: "Chart 5", var: "--chart-5", class: "bg-chart-5" },
  { name: "Success", var: "--chart-success", class: "bg-[var(--chart-success)]" },
  { name: "Danger", var: "--chart-danger", class: "bg-[var(--chart-danger)]" },
  { name: "Alt Lime", var: "--alt-lime", class: "bg-[var(--alt-lime)]" },
  { name: "Alt Blue", var: "--alt-blue", class: "bg-[var(--alt-blue)]" },
  { name: "Alt Amber", var: "--alt-amber", class: "bg-[var(--alt-amber)]" },
];

export default function DeveloperSettingsPage() {
  const sentinelRef = useSetPageHeader("Developer Tools");
  const { user } = useAuth();
  const snapshotFileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingSnapshots, setIsExportingSnapshots] = useState(false);
  const [isImportingSnapshots, setIsImportingSnapshots] = useState(false);
  const [showExampleDialog, setShowExampleDialog] = useState(false);
  const [showExampleAlert, setShowExampleAlert] = useState(false);

  const isDevUser =
    process.env.NODE_ENV === "development" || user?.username === "joshdev";

  const handleExportSnapshots = async () => {
    setIsExportingSnapshots(true);
    try {
      const res = await fetch("/api/portfolio/snapshots");
      if (!res.ok) throw new Error("Failed to fetch snapshots");
      const { data: snapshots } = await res.json();
      if (!snapshots || snapshots.length === 0) {
        toast.error("No snapshots to export");
        return;
      }
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: 1,
        count: snapshots.length,
        snapshots: snapshots.map(
          (s: {
            date: string;
            totalSavings: number;
            totalInvestments: number;
            totalAssets: number;
            totalDebt: number;
            netWorth: number;
            details: unknown;
          }) => ({
            date: s.date,
            totalSavings: s.totalSavings,
            totalInvestments: s.totalInvestments,
            totalAssets: s.totalAssets,
            totalDebt: s.totalDebt,
            netWorth: s.netWorth,
            details: s.details,
          })
        ),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sors-snapshots-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${snapshots.length} snapshots`);
    } catch {
      toast.error("Failed to export snapshots");
    } finally {
      setIsExportingSnapshots(false);
    }
  };

  const handleImportSnapshots = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImportingSnapshots(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.snapshots || !Array.isArray(data.snapshots))
        throw new Error("Invalid snapshot file format");
      let imported = 0,
        skipped = 0;
      for (const snapshot of data.snapshots) {
        if (!snapshot.date) {
          skipped++;
          continue;
        }
        try {
          const res = await fetch("/api/portfolio/snapshots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: snapshot.date,
              totalSavings: snapshot.totalSavings ?? 0,
              totalInvestments: snapshot.totalInvestments ?? 0,
              totalAssets: snapshot.totalAssets ?? 0,
              totalDebt: snapshot.totalDebt ?? 0,
              netWorth: snapshot.netWorth ?? 0,
              details: snapshot.details ?? { accounts: [], items: [] },
            }),
          });
          if (res.ok) imported++;
          else skipped++;
        } catch {
          skipped++;
        }
      }
      if (imported > 0)
        toast.success(
          `Imported ${imported} snapshots${skipped > 0 ? `, ${skipped} skipped` : ""}`
        );
      else toast.error("No snapshots were imported");
    } catch {
      toast.error("Failed to import snapshots. Check file format.");
    } finally {
      setIsImportingSnapshots(false);
      if (snapshotFileInputRef.current) snapshotFileInputRef.current.value = "";
    }
  };

  if (!isDevUser) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Not available.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div ref={sentinelRef} className="h-0" />

      <SettingsBreadcrumb page="Developer Tools" />

      <SettingsPageHeader
        title="Developer Tools"
        description="Snapshot management, component library, and design tokens."
      />

      {/* Snapshot Data */}
      <section className="space-y-2">
        <SectionHeader label="Snapshot History" />
        <RowGroup>
          <ActionRow
            icon={<Database className="h-4 w-4" />}
            title="Export Snapshots"
            description="Download your complete portfolio snapshot history as JSON"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSnapshots}
                disabled={isExportingSnapshots}
              >
                {isExportingSnapshots ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export to JSON
                  </>
                )}
              </Button>
            }
          />
          <ActionRow
            icon={<Upload className="h-4 w-4" />}
            title="Import Snapshots"
            description="Restore snapshot history from a previously exported JSON file"
            action={
              <>
                <input
                  ref={snapshotFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportSnapshots}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => snapshotFileInputRef.current?.click()}
                  disabled={isImportingSnapshots}
                >
                  {isImportingSnapshots ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Import from JSON
                    </>
                  )}
                </Button>
              </>
            }
          />
        </RowGroup>
      </section>

      {/* Component Library */}
      <section className="space-y-2">
        <SectionHeader label="Component Library" />
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Buttons</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="lg">Large</Button>
                <Button size="default">Default</Button>
                <Button size="sm">Small</Button>
                <Button size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setShowExampleDialog(true)} variant="outline">
                  Open Dialog
                </Button>
                <Button onClick={() => setShowExampleAlert(true)} variant="destructive">
                  Open Alert
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Typography</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <h1 className="text-4xl font-bold">Heading 1</h1>
              <h2 className="text-3xl font-bold">Heading 2</h2>
              <h3 className="text-2xl font-semibold">Heading 3</h3>
              <h4 className="text-xl font-semibold">Heading 4</h4>
              <p className="text-base">Body — The quick brown fox.</p>
              <p className="text-sm text-muted-foreground">Muted — Secondary info.</p>
              <p className="text-xs text-muted-foreground">Small — Fine print.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Design Tokens */}
      <section className="space-y-2">
        <SectionHeader label="Design Tokens" />
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Primary Colors</CardTitle>
              <CardDescription>Core UI color tokens</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {DEV_COLORS.map((c) => (
                  <div key={c.var} className="space-y-1">
                    <div className={`h-10 rounded-lg border ${c.class}`} />
                    <p className="text-xs font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{c.var}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Chart Colors</CardTitle>
              <CardDescription>Chart and data visualization tokens</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {DEV_CHART_COLORS.map((c) => (
                  <div key={c.var} className="space-y-1">
                    <div className={`h-10 rounded-lg border ${c.class}`} />
                    <p className="text-xs font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{c.var}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Bank Logos */}
      <section className="space-y-2">
        <SectionHeader label="Bank Logos" />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Supported Banks</CardTitle>
            <CardDescription>Logo assets available for institution matching</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {BANK_LOGOS_DISPLAY.map((bank) => (
                <div key={bank.name} className="flex flex-col items-center gap-2">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bank.bg} shrink-0 overflow-hidden`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bank.path}
                      alt={bank.name}
                      className="h-full w-full object-contain p-2"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center leading-tight">{bank.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Example Dialog */}
      <Dialog open={showExampleDialog} onOpenChange={setShowExampleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Example Dialog</DialogTitle>
            <DialogDescription>This is an example dialog with a form input.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input placeholder="Enter something..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExampleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowExampleDialog(false)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Example Alert */}
      <AlertDialog open={showExampleAlert} onOpenChange={setShowExampleAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This is an example alert dialog.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
