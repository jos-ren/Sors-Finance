"use client";

import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Click-to-edit label that commits a renamed value on blur/Enter. */
export function InlineRename({
  value,
  onCommit,
  className,
}: {
  value: string;
  onCommit: (name: string) => Promise<unknown> | void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        className={cn("truncate rounded px-1 text-left hover:bg-accent/60", className)}
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        {value}
      </button>
    );
  }

  const commit = async () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== value) await onCommit(name);
  };

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        else if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
      }}
      className="h-7 max-w-[220px] py-0 text-sm"
    />
  );
}

/** A "+ Add …" affordance that expands into an inline name input. */
export function AddInline({
  label,
  small,
  onAdd,
}: {
  label: string;
  small?: boolean;
  onAdd: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setOpen(false); return; }
    setBusy(true);
    try {
      await onAdd(trimmed);
      setName("");
      setOpen(false);
    } catch {
      toast.error("Failed to add");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className={cn("gap-1.5 text-muted-foreground", small && "h-7 text-xs")} onClick={() => setOpen(true)}>
        <Plus className={small ? "h-3.5 w-3.5" : "h-4 w-4"} /> {label}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          else if (e.key === "Escape") { e.preventDefault(); setOpen(false); setName(""); }
        }}
        placeholder={label}
        className={cn("h-8 max-w-[220px]", small && "h-7 text-xs")}
        disabled={busy}
      />
      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={submit} disabled={busy}>
        <Check className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => { setOpen(false); setName(""); }} disabled={busy}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
