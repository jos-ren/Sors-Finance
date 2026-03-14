"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

// ─── Section header ───────────────────────────────────────────────────────────

export function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-0.5">
      {label}
    </p>
  );
}

// ─── Row group (rounded bordered container with dividers) ─────────────────────

export function RowGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border overflow-hidden divide-y divide-border bg-card">
      {children}
    </div>
  );
}

// ─── NavigateRow ──────────────────────────────────────────────────────────────

interface NavigateRowProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  value?: string;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
}

export function NavigateRow({
  icon,
  title,
  description,
  value,
  href,
  onClick,
  destructive,
}: NavigateRowProps) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-muted/40",
        destructive && "hover:bg-destructive/5"
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          destructive ? "bg-destructive/10" : "bg-muted"
        )}
      >
        <span className={destructive ? "text-destructive" : "text-muted-foreground"}>
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", destructive && "text-destructive")}>{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {value && <span className="text-sm text-muted-foreground">{value}</span>}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );

  if (href) return <Link href={href} className="block">{content}</Link>;
  return content;
}

// ─── ToggleRow ────────────────────────────────────────────────────────────────

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  id?: string;
  disabled?: boolean;
}

export function ToggleRow({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
  id,
  disabled,
}: ToggleRowProps) {
  return (
    <div className={cn("flex items-center gap-3 p-4", disabled && "opacity-50")}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {title}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

// ─── ActionRow ────────────────────────────────────────────────────────────────

interface ActionRowProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: string;
  action: React.ReactNode;
}

export function ActionRow({ icon, title, description, action }: ActionRowProps) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

// ─── SettingsItemRow ──────────────────────────────────────────────────────────
// For sub-page lists where each item has icon-button actions (edit, delete, etc.)

interface SettingsItemRowProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  meta?: React.ReactNode;
  actions: React.ReactNode;
}

export function SettingsItemRow({
  icon,
  title,
  description,
  meta,
  actions,
}: SettingsItemRowProps) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
        )}
        {meta && <div className="mt-1">{meta}</div>}
      </div>
      <div className="flex items-center gap-1 ml-4 shrink-0">{actions}</div>
    </div>
  );
}

// ─── SettingsPageHeader ───────────────────────────────────────────────────────
// Consistent h1 + description + optional action slot for every sub-page

interface SettingsPageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SettingsPageHeader({ title, description, action }: SettingsPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─── SettingsBreadcrumb ───────────────────────────────────────────────────────
// Single-prop breadcrumb: Settings / <page>

export function SettingsBreadcrumb({ page }: { page: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/settings">Settings</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{page}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
