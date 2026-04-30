"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, RefreshCw, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { InfoCard } from "@/components/ui/info-card";
import {
  SettingsBreadcrumb,
  SettingsPageHeader,
  SectionHeader,
  RowGroup,
  ToggleRow,
  ActionRow,
} from "@/components/features/settings/settings-shared";

export default function SnapshotsSettingsPage() {
  const sentinelRef = useSetPageHeader("Snapshot Schedule");

  const [snapshotEnabled, setSnapshotEnabled] = useState(true);
  const [snapshotTime, setSnapshotTime] = useState("03:00");
  const [plaidSyncEnabled, setPlaidSyncEnabled] = useState(false);
  const [priceRefreshEnabled, setPriceRefreshEnabled] = useState(true);
  const [plaidConfigured, setPlaidConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/scheduler/config").then((r) => r.json()),
      fetch("/api/integrations/status").then((r) => r.json()),
    ])
      .then(([{ data }, statusData]) => {
        setSnapshotEnabled(data?.enabled ?? true);
        setSnapshotTime(data?.time || "03:00");
        setPlaidSyncEnabled(data?.plaidSync ?? false);
        setPriceRefreshEnabled(data?.priceRefresh ?? true);
        setPlaidConfigured(statusData?.plaid ?? false);
      })
      .catch((err) => {
        console.error("Failed to load snapshot config:", err);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const updateConfig = async (patch: Record<string, unknown>) => {
    const res = await fetch("/api/scheduler/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to update");
  };

  const handleSnapshotEnabledChange = async (checked: boolean) => {
    try {
      await updateConfig({ enabled: checked });
      setSnapshotEnabled(checked);
      toast.success(checked ? "Automatic snapshots enabled" : "Automatic snapshots disabled");
    } catch {
      toast.error("Failed to update setting");
    }
  };

  const handleSnapshotTimeChange = async (time: string) => {
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      toast.error("Invalid time format. Use HH:MM (e.g., 03:00)");
      return;
    }
    try {
      await updateConfig({ time });
      setSnapshotTime(time);
      toast.success(`Snapshot time set to ${time}`);
    } catch {
      toast.error("Failed to update setting");
    }
  };

  const handlePlaidSyncChange = async (checked: boolean) => {
    try {
      await updateConfig({ plaidSync: checked });
      setPlaidSyncEnabled(checked);
      toast.success(checked ? "Plaid sync enabled with snapshots" : "Plaid sync disabled");
    } catch {
      toast.error("Failed to update setting");
    }
  };

  const handlePriceRefreshChange = async (checked: boolean) => {
    try {
      await updateConfig({ priceRefresh: checked });
      setPriceRefreshEnabled(checked);
      toast.success(checked ? "Price refresh enabled with snapshots" : "Price refresh disabled");
    } catch {
      toast.error("Failed to update setting");
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div ref={sentinelRef} className="h-0" />

      <SettingsBreadcrumb page="Snapshot Schedule" />

      <SettingsPageHeader
        title="Snapshot Schedule"
        description="Configure automatic daily snapshots of your net worth history."
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading configuration...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Schedule section */}
          <section className="space-y-2">
            <SectionHeader label="Schedule" />
            <RowGroup>
              <ToggleRow
                id="snapshot-enabled"
                icon={<Calendar className="h-4 w-4" />}
                title="Enable automatic snapshots"
                description="Automatically save a snapshot of your portfolio each day"
                checked={snapshotEnabled}
                onCheckedChange={handleSnapshotEnabledChange}
              />
              <ActionRow
                icon={<Clock className="h-4 w-4" />}
                title="Snapshot time"
                description="Time of day when the automatic snapshot will be taken (24-hour HH:MM)"
                action={
                  <Input
                    id="snapshot-time"
                    type="text"
                    placeholder="03:00"
                    value={snapshotTime}
                    onChange={(e) => setSnapshotTime(e.target.value)}
                    onBlur={(e) => handleSnapshotTimeChange(e.target.value)}
                    className="w-24 font-mono text-center"
                    disabled={!snapshotEnabled}
                    maxLength={5}
                  />
                }
              />
            </RowGroup>
          </section>

          {/* Pre-snapshot actions section */}
          <section className="space-y-2">
            <SectionHeader label="Pre-snapshot Actions" />
            <RowGroup>
              <ToggleRow
                id="price-refresh-enabled"
                icon={<RefreshCw className="h-4 w-4" />}
                title="Refresh ticker prices"
                description="Automatically refresh stock, crypto, and metal prices before each snapshot"
                checked={priceRefreshEnabled}
                onCheckedChange={handlePriceRefreshChange}
                disabled={!snapshotEnabled}
              />
              {plaidConfigured && (
                <ToggleRow
                  id="plaid-sync-enabled"
                  icon={<Building2 className="h-4 w-4" />}
                  title="Sync Plaid balances"
                  description="Automatically sync Plaid account balances before each scheduled snapshot"
                  checked={plaidSyncEnabled}
                  onCheckedChange={handlePlaidSyncChange}
                  disabled={!snapshotEnabled}
                />
              )}
            </RowGroup>
          </section>

          <InfoCard variant="info" title="Important">
            For automatic snapshots to work, the application must be running at the scheduled time. This means:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                <strong>Local:</strong> Keep{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">npm run dev</code> running
              </li>
              <li>
                <strong>Docker:</strong> Ensure the Docker container is running
              </li>
            </ul>
          </InfoCard>
        </div>
      )}
    </div>
  );
}

