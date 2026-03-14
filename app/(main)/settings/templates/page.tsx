"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { FileText, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSetPageHeader } from "@/lib/page-header-context";
import {
  SettingsBreadcrumb,
  SettingsPageHeader,
  SectionHeader,
  RowGroup,
  SettingsItemRow,
} from "@/components/settings/SettingsShared";

interface TemplateItem {
  id: number;
  uuid: string;
  name: string;
  mapping: {
    dateColumn?: number;
    descriptionColumn?: number;
    amountInColumn?: number;
    amountOutColumn?: number;
    dateFormat?: string;
    hasHeaders?: boolean;
    useNegativeForOut?: boolean;
    matchFieldColumns?: number[];
  };
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesSettingsPage() {
  const sentinelRef = useSetPageHeader("Import Templates");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editMapping, setEditMapping] = useState({
    dateColumn: 0,
    descriptionColumn: 1,
    amountInColumn: 2,
    amountOutColumn: 3,
    hasHeaders: true,
    useNegativeForOut: false,
  });
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const res = await fetch("/api/custom-import-templates");
      if (res.ok) {
        const { data } = await res.json();
        setTemplates(data || []);
      }
    } catch {
      console.warn("Failed to load templates");
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleEditTemplate = (template: TemplateItem) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditMapping({
      dateColumn: template.mapping.dateColumn ?? 0,
      descriptionColumn: template.mapping.descriptionColumn ?? 1,
      amountInColumn: template.mapping.amountInColumn ?? 2,
      amountOutColumn: template.mapping.amountOutColumn ?? 3,
      hasHeaders: template.mapping.hasHeaders ?? true,
      useNegativeForOut: template.mapping.useNegativeForOut ?? false,
    });
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      const res = await fetch(`/api/custom-import-templates/${editingTemplate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), mapping: editMapping }),
      });
      if (res.ok) {
        toast.success("Template updated");
        setEditingTemplate(null);
        loadTemplates();
      } else {
        toast.error("Failed to update template");
      }
    } catch {
      toast.error("Failed to update template");
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    try {
      const res = await fetch(`/api/custom-import-templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Template deleted");
        setDeletingTemplateId(null);
        loadTemplates();
      } else {
        toast.error("Failed to delete template");
      }
    } catch {
      toast.error("Failed to delete template");
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div ref={sentinelRef} className="h-0" />

      <SettingsBreadcrumb page="Import Templates" />

      <SettingsPageHeader
        title="Import Templates"
        description="Manage your custom CSV/Excel column mapping templates. Templates are created during file imports when you save a custom column configuration."
      />

      {/* Template list */}
      <section className="space-y-2">
        <SectionHeader label="Saved Templates" />
        {isLoadingTemplates ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border bg-card">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Templates are created during file import when you configure a custom column mapping
              and choose to save it.
            </p>
          </div>
        ) : (
          <RowGroup>
            {templates.map((template) => (
              <SettingsItemRow
                key={template.id}
                icon={<FileText className="h-4 w-4" />}
                title={template.name}
                meta={
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>Date: col {(template.mapping.dateColumn ?? 0) + 1}</span>
                    <span>Desc: col {(template.mapping.descriptionColumn ?? 0) + 1}</span>
                    <span>In: col {(template.mapping.amountInColumn ?? 0) + 1}</span>
                    <span>Out: col {(template.mapping.amountOutColumn ?? 0) + 1}</span>
                    {template.mapping.hasHeaders && (
                      <Badge variant="outline" className="text-xs">Headers</Badge>
                    )}
                    {template.mapping.useNegativeForOut && (
                      <Badge variant="outline" className="text-xs">Negative=Out</Badge>
                    )}
                  </div>
                }
                actions={
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditTemplate(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeletingTemplateId(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                }
              />
            ))}
          </RowGroup>
        )}
      </section>

      <Dialog
        open={editingTemplate !== null}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update the template name and column mappings. Column numbers are 1-based.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date Column</Label>
                <Input
                  type="number"
                  min={1}
                  value={editMapping.dateColumn + 1}
                  onChange={(e) =>
                    setEditMapping((prev) => ({
                      ...prev,
                      dateColumn: Math.max(0, parseInt(e.target.value) - 1) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description Column</Label>
                <Input
                  type="number"
                  min={1}
                  value={editMapping.descriptionColumn + 1}
                  onChange={(e) =>
                    setEditMapping((prev) => ({
                      ...prev,
                      descriptionColumn: Math.max(0, parseInt(e.target.value) - 1) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Amount In Column</Label>
                <Input
                  type="number"
                  min={1}
                  value={editMapping.amountInColumn + 1}
                  onChange={(e) =>
                    setEditMapping((prev) => ({
                      ...prev,
                      amountInColumn: Math.max(0, parseInt(e.target.value) - 1) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Amount Out Column</Label>
                <Input
                  type="number"
                  min={1}
                  value={editMapping.amountOutColumn + 1}
                  onChange={(e) =>
                    setEditMapping((prev) => ({
                      ...prev,
                      amountOutColumn: Math.max(0, parseInt(e.target.value) - 1) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="has-headers"
                  checked={editMapping.hasHeaders}
                  onCheckedChange={(checked) =>
                    setEditMapping((prev) => ({ ...prev, hasHeaders: !!checked }))
                  }
                />
                <Label htmlFor="has-headers">First row is headers</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="negative-out"
                  checked={editMapping.useNegativeForOut}
                  onCheckedChange={(checked) =>
                    setEditMapping((prev) => ({ ...prev, useNegativeForOut: !!checked }))
                  }
                />
                <Label htmlFor="negative-out">Negative values = outgoing</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={!editName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation */}
      <AlertDialog
        open={deletingTemplateId !== null}
        onOpenChange={(open) => !open && setDeletingTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This cannot be undone. Existing
              imports that used this template are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deletingTemplateId && handleDeleteTemplate(deletingTemplateId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
