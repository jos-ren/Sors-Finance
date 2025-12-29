"use client";

import { useState } from "react";
import { useSetPageHeader } from "@/lib/page-header-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";

export default function DevPage() {
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  // Set page header and get sentinel ref
  const sentinelRef = useSetPageHeader("Developer");

  const colors = [
    { name: "Background", var: "--background", class: "bg-background" },
    { name: "Foreground", var: "--foreground", class: "bg-foreground" },
    { name: "Primary", var: "--primary", class: "bg-primary" },
    { name: "Primary Foreground", var: "--primary-foreground", class: "bg-primary-foreground" },
    { name: "Secondary", var: "--secondary", class: "bg-secondary" },
    { name: "Secondary Foreground", var: "--secondary-foreground", class: "bg-secondary-foreground" },
    { name: "Muted", var: "--muted", class: "bg-muted" },
    { name: "Muted Foreground", var: "--muted-foreground", class: "bg-muted-foreground" },
    { name: "Accent", var: "--accent", class: "bg-accent" },
    { name: "Accent Foreground", var: "--accent-foreground", class: "bg-accent-foreground" },
    { name: "Destructive", var: "--destructive", class: "bg-destructive" },
    { name: "Border", var: "--border", class: "bg-border" },
    { name: "Input", var: "--input", class: "bg-input" },
    { name: "Ring", var: "--ring", class: "bg-ring" },
    { name: "Card", var: "--card", class: "bg-card" },
    { name: "Card Foreground", var: "--card-foreground", class: "bg-card-foreground" },
    { name: "Popover", var: "--popover", class: "bg-popover" },
    { name: "Popover Foreground", var: "--popover-foreground", class: "bg-popover-foreground" },
  ];

  const chartColors = [
    { name: "Chart 1", var: "--chart-1", class: "bg-chart-1" },
    { name: "Chart 2", var: "--chart-2", class: "bg-chart-2" },
    { name: "Chart 3", var: "--chart-3", class: "bg-chart-3" },
    { name: "Chart 4", var: "--chart-4", class: "bg-chart-4" },
    { name: "Chart 5", var: "--chart-5", class: "bg-chart-5" },
    { name: "Chart Success", var: "--chart-success", class: "bg-[var(--chart-success)]" },
    { name: "Chart Danger", var: "--chart-danger", class: "bg-[var(--chart-danger)]" },
    { name: "Alt Orange", var: "--alt-orange", class: "bg-[var(--alt-orange)]" },
    { name: "Alt Amber", var: "--alt-amber", class: "bg-[var(--alt-amber)]" },
    { name: "Alt Blue", var: "--alt-blue", class: "bg-[var(--alt-blue)]" },
    { name: "Alt Cyan", var: "--alt-cyan", class: "bg-[var(--alt-cyan)]" },
    { name: "Alt Emerald", var: "--alt-emerald", class: "bg-[var(--alt-emerald)]" },
    { name: "Alt Fuchsia", var: "--alt-fuchsia", class: "bg-[var(--alt-fuchsia)]" },
    { name: "Alt Green", var: "--alt-green", class: "bg-[var(--alt-green)]" },
    { name: "Alt Indigo", var: "--alt-indigo", class: "bg-[var(--alt-indigo)]" },
    { name: "Alt Lime", var: "--alt-lime", class: "bg-[var(--alt-lime)]" },
    { name: "Alt Pink", var: "--alt-pink", class: "bg-[var(--alt-pink)]" },
  ];

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Developer</h1>
        <p className="text-muted-foreground">
          UI component showcase and design system reference
        </p>
        <div ref={sentinelRef} className="h-0" />
      </div>

      {/* Primary Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Primary Colors</CardTitle>
          <CardDescription>Core color palette used throughout the app</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {colors.map((color) => (
              <div key={color.var} className="space-y-1.5">
                <div
                  className={`h-16 rounded-lg border ${color.class}`}
                />
                <div className="text-xs">
                  <p className="font-medium">{color.name}</p>
                  <p className="text-muted-foreground font-mono">{color.var}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chart Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Chart Colors</CardTitle>
          <CardDescription>Colors used for charts and data visualization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {chartColors.map((color) => (
              <div key={color.var} className="space-y-1.5">
                <div
                  className={`h-16 rounded-lg border ${color.class}`}
                />
                <div className="text-xs">
                  <p className="font-medium">{color.name}</p>
                  <p className="text-muted-foreground font-mono">{color.var}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Button variants and sizes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Variants</p>
            <div className="flex flex-wrap gap-3">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Sizes</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg">Large</Button>
              <Button size="default">Default</Button>
              <Button size="sm">Small</Button>
              <Button size="icon"><Plus className="h-4 w-4" /></Button>
              <Button size="icon-sm"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">With Icons</p>
            <div className="flex flex-wrap gap-3">
              <Button><Plus className="h-4 w-4 mr-2" />Add Item</Button>
              <Button variant="outline"><Pencil className="h-4 w-4 mr-2" />Edit</Button>
              <Button variant="destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
              <Button variant="secondary"><Check className="h-4 w-4 mr-2" />Confirm</Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">States</p>
            <div className="flex flex-wrap gap-3">
              <Button disabled>Disabled</Button>
              <Button variant="outline" disabled>Disabled Outline</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>Badge variants for labels and status indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Card>
        <CardHeader>
          <CardTitle>Dialogs</CardTitle>
          <CardDescription>Modal dialogs and alert dialogs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setShowDialog(true)}>
              Open Dialog
            </Button>
            <Button variant="destructive" onClick={() => setShowAlertDialog(true)}>
              Open Alert Dialog
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
          <CardDescription>Form input components</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Default Input</p>
              <Input placeholder="Enter text..." />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Disabled Input</p>
              <Input placeholder="Disabled" disabled />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">With Value</p>
              <Input defaultValue="Sample value" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Checkbox</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="check1" />
                <label htmlFor="check1" className="text-sm">Unchecked</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="check2" defaultChecked />
                <label htmlFor="check2" className="text-sm">Checked</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="check3" disabled />
                <label htmlFor="check3" className="text-sm text-muted-foreground">Disabled</label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tooltips */}
      <Card>
        <CardHeader>
          <CardTitle>Tooltips</CardTitle>
          <CardDescription>Hover tooltips for additional context</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Hover me</Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This is a tooltip</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit item</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete item</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>Text styles and headings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Heading 1</h1>
            <h2 className="text-3xl font-bold tracking-tight">Heading 2</h2>
            <h3 className="text-2xl font-semibold">Heading 3</h3>
            <h4 className="text-xl font-semibold">Heading 4</h4>
            <h5 className="text-lg font-medium">Heading 5</h5>
            <p className="text-base">Body text - The quick brown fox jumps over the lazy dog.</p>
            <p className="text-sm text-muted-foreground">Muted text - Secondary information or descriptions.</p>
            <p className="text-xs text-muted-foreground">Small text - Fine print or metadata.</p>
          </div>
        </CardContent>
      </Card>

      {/* Spacing Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Spacing</CardTitle>
          <CardDescription>Common spacing values used in the app</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 6, 8, 12, 16].map((space) => (
              <div key={space} className="flex items-center gap-3">
                <div className={`bg-primary h-4 w-${space}`} style={{ width: `${space * 4}px` }} />
                <span className="text-sm font-mono text-muted-foreground">
                  {space} ({space * 4}px)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alert Dialog */}
      <AlertDialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This is an example alert dialog. It asks for confirmation before performing a destructive action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => setShowAlertDialog(false)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regular Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Example Dialog</DialogTitle>
            <DialogDescription>
              This is an example dialog with a form input.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input placeholder="Enter something..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowDialog(false)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
