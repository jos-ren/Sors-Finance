"use client";

import { useState, useEffect } from "react";
import { PlaidBankingConnections } from "@/components/plaid/PlaidBankingConnections";
import { useSetPageHeader } from "@/lib/page-header-context";
import {
  SettingsBreadcrumb,
  SettingsPageHeader,
} from "@/components/settings/SettingsShared";

export default function PlaidSettingsPage() {
  const sentinelRef = useSetPageHeader("Plaid Banking");
  const [plaidConfigured, setPlaidConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/integrations/status")
      .then((r) => r.json())
      .then((data) => setPlaidConfigured(data?.plaid ?? false))
      .catch(() => setPlaidConfigured(false));
  }, []);

  return (
    <div className="p-6 space-y-8">
      <div ref={sentinelRef} className="h-0" />

      <SettingsBreadcrumb page="Plaid Banking" />

      <SettingsPageHeader
        title="Plaid Banking"
        description="Connect and manage your bank account connections via Plaid."
      />

      <PlaidBankingConnections plaidConfigured={plaidConfigured} />
    </div>
  );
}
