"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoCard } from "@/components/ui/info-card";
import { useSettings } from "@/contexts/settings-context";

const DISMISSED_KEY = "sors-api-key-banner-dismissed";

// Check if banner was previously dismissed (read from localStorage on mount)
function getIsDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DISMISSED_KEY) === "true";
}

export function ApiKeyBanner() {
  const { hasFinnhubApiKey, isLoading } = useSettings();
  const [dismissed, setDismissed] = useState(getIsDismissed);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }, []);

  // Don't show while loading, if key is configured, or if user dismissed
  if (isLoading || hasFinnhubApiKey || dismissed) {
    return null;
  }

  return (
    <InfoCard
      variant="warning"
      title="Stock Price Updates Disabled"
      className="mb-0"
    >
      <div className="space-y-3">
        <p>
          Without a Finnhub API key, you&apos;ll need to{" "}
          <strong>manually update stock prices</strong>. The automatic refresh
          button won&apos;t work. Add a free API key to enable live stock prices.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" asChild>
            <Link href="/settings">
              <Settings className="h-4 w-4 mr-2" />
              Configure API Key
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Dismiss
          </Button>
        </div>
      </div>
    </InfoCard>
  );
}
