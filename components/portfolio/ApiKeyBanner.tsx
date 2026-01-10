"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, Settings, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings-context";

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
    <Alert className="border-yellow-500/50 bg-yellow-500/10">
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <AlertTitle className="text-yellow-600 dark:text-yellow-400">
        Stock Price Updates Disabled
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p className="text-muted-foreground">
          Without a Finnhub API key, you&apos;ll need to{" "}
          <strong>manually update stock prices</strong>. The automatic refresh
          button won&apos;t work. Add a free API key to enable live stock
          prices.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" asChild>
            <Link href="/settings?tab=integrations">
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
      </AlertDescription>
    </Alert>
  );
}
