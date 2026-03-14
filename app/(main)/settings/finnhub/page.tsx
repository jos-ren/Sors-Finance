"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from "react";
import { ChevronDown, ExternalLink, Loader2, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoCard } from "@/components/ui/info-card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSetPageHeader } from "@/lib/page-header-context";
import {
  SettingsBreadcrumb,
  SettingsPageHeader,
  SectionHeader,
  RowGroup,
  ActionRow,
} from "@/components/settings/SettingsShared";

export default function FinnhubSettingsPage() {
  const sentinelRef = useSetPageHeader("Finnhub");
  const [finnhubConfigured, setFinnhubConfigured] = useState<boolean | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [setupOpen, setSetupOpen] = useState<boolean | null>(null);

  const effectiveSetupOpen = setupOpen !== null ? setupOpen : finnhubConfigured === false;

  useEffect(() => {
    fetch("/api/integrations/has-finnhub-key")
      .then((r) => r.json())
      .then((data) => setFinnhubConfigured(data.hasKey))
      .catch(() => setFinnhubConfigured(false));
  }, []);

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const response = await fetch("/api/integrations/test-finnhub");
      const data = await response.json();
      if (data.success) toast.success("Finnhub API key is valid and working!");
      else toast.error(data.error || "Invalid Finnhub API key");
    } catch {
      toast.error("Failed to test Finnhub API key");
    } finally {
      setIsTesting(false);
    }
  };

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      const response = await fetch("/api/integrations/has-finnhub-key");
      const data = await response.json();
      setFinnhubConfigured(data.hasKey);
      if (data.hasKey) toast.success("Finnhub API key detected!");
      else toast.error("No Finnhub API key found in environment");
    } catch {
      toast.error("Failed to check for Finnhub API key");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div ref={sentinelRef} className="h-0" />
      <SettingsBreadcrumb page="Finnhub" />
      <SettingsPageHeader
        title="Finnhub"
        description="Real-time stock, crypto & precious metal prices for your portfolio."
      />

      {/* Configuration — status + setup in one section */}
      <section className="space-y-2">
        <SectionHeader label="Configuration" />
        <RowGroup>
          <ActionRow
            icon={
              <img
                src="/logos/finnhub.png"
                alt="Finnhub"
                className="h-5 w-auto object-contain"
              />
            }
            title={
              <span className="flex items-center gap-2">
                API Key
                {finnhubConfigured === null ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : finnhubConfigured ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    Not set up
                  </span>
                )}
              </span>
            }
            description="Finnhub API key for stock, crypto & metals pricing"
            action={
              <div className="flex items-center gap-2">
                {finnhubConfigured === null ? null : finnhubConfigured ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      "Test Connection"
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheck}
                    disabled={isChecking}
                  >
                    {isChecking ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      "Check for API Key"
                    )}
                  </Button>
                )}
              </div>
            }
          />

          {/* Setup instructions — collapsible */}
          <Collapsible
            open={effectiveSetupOpen}
            onOpenChange={(open) => setSetupOpen(open)}
          >
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors border-t">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 shrink-0">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Setup Instructions</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    How to add your Finnhub API key
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                    effectiveSetupOpen && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-5 pt-3 space-y-4 border-t">
                <InfoCard variant="info" title="Free API Key">
                  No credit card required. The free Finnhub tier covers stock quotes, crypto, and
                  metals pricing.{" "}
                  <a
                    href="https://finnhub.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-700 dark:text-blue-300 inline-flex items-center gap-0.5 hover:underline"
                  >
                    finnhub.io <ExternalLink className="h-3 w-3" />
                  </a>
                </InfoCard>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Steps</p>
                  <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside ml-2">
                    <li>
                      Register at{" "}
                      <a
                        href="https://finnhub.io/register"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lime-600 hover:underline"
                      >
                        finnhub.io/register
                      </a>
                    </li>
                    <li>Copy your API key from the dashboard</li>
                  </ol>
                  <p className="text-sm text-muted-foreground ml-2">
                    3. Add the key for your deployment:
                  </p>
                  <Tabs defaultValue="local">
                    <TabsList className="w-fit">
                      <TabsTrigger value="local">
                        <Monitor className="h-3.5 w-3.5 mr-1.5" />
                        Local
                      </TabsTrigger>
                      <TabsTrigger value="docker">
                        <img
                          src="/logos/docker.png"
                          alt="Docker"
                          className="h-3.5 w-3.5 mr-1.5"
                        />
                        Docker
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="local"
                      className="mt-3 text-sm text-muted-foreground space-y-2"
                    >
                      <p>
                        Add to your{" "}
                        <code className="bg-muted px-1 rounded">.env</code> file:
                      </p>
                      <pre className="p-2 bg-muted rounded text-xs overflow-x-auto">
                        FINNHUB_API_KEY=your_api_key_here
                      </pre>
                      <p>Restart the development server.</p>
                    </TabsContent>
                    <TabsContent
                      value="docker"
                      className="mt-3 text-sm text-muted-foreground space-y-2"
                    >
                      <p>
                        Add in your stack&apos;s <strong>Environment Variables</strong> section
                        (e.g. Portainer):
                      </p>
                      <pre className="p-2 bg-muted rounded text-xs overflow-x-auto">
                        FINNHUB_API_KEY=your_api_key_here
                      </pre>
                      <p className="text-xs">
                        Or pass via{" "}
                        <code className="bg-muted px-1 rounded">environment:</code> in your{" "}
                        <code className="bg-muted px-1 rounded">docker-compose.yml</code>.
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </RowGroup>
      </section>
    </div>
  );
}
