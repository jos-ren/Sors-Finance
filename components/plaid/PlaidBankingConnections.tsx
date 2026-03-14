/**
 * Plaid Banking Connections Component — redesigned to match settings page style
 */

"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from "react";
import {
  Building2,
  ExternalLink,
  Trash2,
  Loader2,
  Monitor,
  Pencil,
  PiggyBank,
  TrendingUp,
  Home,
  CreditCard,
  ChevronDown,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { InfoCard } from "@/components/ui/info-card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type PlaidEnvironmentType } from "@/lib/plaid/types";
import { formatCurrency } from "@/lib/formatters";
import { getBankLogo } from "@/lib/bank-logos";
import { SectionHeader, RowGroup } from "@/components/settings/SettingsShared";
import { PlaidLinkButton } from "./PlaidLinkButton";
import { PlaidSyncButton } from "./PlaidSyncButton";
import { PlaidBucketSelector } from "./PlaidBucketSelector";

interface PlaidInstitution {
  id: number;
  institutionName: string;
  institutionId: string;
  status: string;
  lastSync?: Date;
  environment: PlaidEnvironmentType;
  accessToken?: string;
  accounts: Array<{
    id: number;
    name: string;
    officialName?: string | null;
    type: string;
    subtype: string;
    mask?: string;
    portfolioAccountId?: number | null;
    portfolioAccountName?: string | null;
    portfolioBucket?: string | null;
    portfolioItemName?: string | null;
    currentBalance?: number | null;
  }>;
}

const BUCKET_ICONS: Record<string, { icon: typeof PiggyBank; color: string }> = {
  Savings: { icon: PiggyBank, color: "text-emerald-500" },
  Investments: { icon: TrendingUp, color: "text-blue-500" },
  Assets: { icon: Home, color: "text-amber-500" },
  Debt: { icon: CreditCard, color: "text-red-500" },
};

// Simple deterministic colour for a bank's avatar
const AVATAR_COLORS = [
  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
];

function bankAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

interface PlaidBankingConnectionsProps {
  plaidConfigured: boolean | null;
}

export function PlaidBankingConnections({ plaidConfigured }: PlaidBankingConnectionsProps) {
  const [institutions, setInstitutions] = useState<PlaidInstitution[]>([]);
  const [isLoadingInstitutions, setIsLoadingInstitutions] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<PlaidInstitution | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [expandedBanks, setExpandedBanks] = useState<Set<number>>(new Set());
  const [plaidEnvironment, setPlaidEnvironment] = useState<PlaidEnvironmentType>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("plaid-environment");
      if (saved === "sandbox" || saved === "production") return saved;
    }
    return "production";
  });

  const loadInstitutions = async () => {
    setIsLoadingInstitutions(true);
    try {
      const response = await fetch("/api/plaid/institutions");
      if (response.ok) {
        const data = await response.json();
        setInstitutions(data.institutions || []);
      }
    } catch (error) {
      console.error("Failed to load institutions:", error);
    } finally {
      setIsLoadingInstitutions(false);
    }
  };

  useEffect(() => {
    loadInstitutions();
  }, []);

  const handleTestCredentials = async () => {
    setIsTesting(true);
    try {
      const response = await fetch("/api/plaid/test");
      const data = await response.json();
      if (data.success) {
        toast.success("Plaid credentials are valid and working!");
      } else {
        toast.error(data.error || "Invalid Plaid credentials");
      }
    } catch {
      toast.error("Failed to test credentials");
    } finally {
      setIsTesting(false);
    }
  };

  const handleDeleteInstitution = async (itemId: number) => {
    try {
      const response = await fetch(`/api/plaid/items/${itemId}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Bank connection removed");
        await loadInstitutions();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to remove bank connection");
      }
    } catch {
      toast.error("Failed to remove bank connection");
    }
  };

  const toggleBank = (id: number) =>
    setExpandedBanks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Setup instructions are open by default when Plaid is not configured
  const [setupOpen, setSetupOpen] = useState<boolean | null>(null);
  const effectiveSetupOpen =
    setupOpen !== null ? setupOpen : plaidConfigured === false;

  return (
    <div className="space-y-8">

      {/* ── Status & Setup section ──────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionHeader label="Configuration" />
        <RowGroup>
          {/* Status row */}
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <img src="/logos/plaid.png" alt="Plaid" className="h-5 w-auto object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">API Credentials</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Plaid client ID and secret for bank connections
              </p>
            </div>
            <div className="flex items-center gap-2">
              {plaidConfigured === null ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : plaidConfigured ? (
                <>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Configured
                  </span>
                  <Button variant="outline" size="sm" onClick={handleTestCredentials} disabled={isTesting}>
                    {isTesting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Testing...</> : "Test Connection"}
                  </Button>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  Not configured
                </span>
              )}
            </div>
          </div>

          {/* Setup instructions — collapsible */}
          <Collapsible open={effectiveSetupOpen} onOpenChange={setSetupOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors border-t">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Setup Instructions</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    How to configure Plaid credentials
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    effectiveSetupOpen && "rotate-180"
                  )}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4 border-t bg-muted/20">
                <div className="pt-4 space-y-3">
                  <InfoCard variant="info" title="Production API Keys Required">
                    <div className="space-y-2 text-xs">
                      <p>
                        Plaid offers Sandbox (test) and Production modes. Sandbox environments cannot import real
                        transactions. Use Production keys to connect actual bank accounts.
                      </p>
                      <p>
                        <strong>Required scopes:</strong>{" "}
                        <span className="text-foreground">Transactions</span>{" "}
                        ($0.30/account/month) and{" "}
                        <span className="text-foreground">Balance</span>{" "}
                        ($0.10/call).
                      </p>
                    </div>
                  </InfoCard>

                  <ol className="text-sm space-y-2 text-muted-foreground list-decimal list-inside ml-1">
                    <li>
                      Create a free account at{" "}
                      <a
                        href="https://dashboard.plaid.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lime-600 hover:underline"
                      >
                        dashboard.plaid.com
                      </a>
                    </li>
                    <li>
                      Copy your{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">client_id</code> and{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">secret</code> from the Keys section
                    </li>
                  </ol>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground ml-1">3. Add credentials for your deployment:</p>
                    <Tabs defaultValue="local">
                      <TabsList className="w-fit">
                        <TabsTrigger value="local">
                          <Monitor className="h-3.5 w-3.5 mr-1.5" />
                          Local
                        </TabsTrigger>
                        <TabsTrigger value="docker">
                          <img src="/logos/docker.png" alt="Docker" className="h-3.5 w-3.5 mr-1.5" />
                          Docker
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="local" className="mt-3 text-sm text-muted-foreground space-y-1">
                        <p>
                          Add to your <code className="bg-muted px-1 py-0.5 rounded">.env</code> file:
                        </p>
                        <pre className="p-2 bg-muted rounded text-xs overflow-x-auto">
{`PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_secret_here`}
                        </pre>
                        <p>Restart the development server.</p>
                      </TabsContent>
                      <TabsContent value="docker" className="mt-3 text-sm text-muted-foreground space-y-1">
                        <p>
                          Add in your stack&apos;s <strong>Environment Variables</strong> section (e.g. Portainer):
                        </p>
                        <pre className="p-2 bg-muted rounded text-xs overflow-x-auto">
{`PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_secret_here`}
                        </pre>
                        <p className="text-xs">
                          Or pass via{" "}
                          <code className="bg-muted px-1 rounded">environment:</code> in your{" "}
                          <code className="bg-muted px-1 rounded">docker-compose.yml</code>.
                        </p>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <a
                    href="https://plaid.com/docs/quickstart/#introduction"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-lime-600 hover:text-lime-700 dark:text-lime-400"
                  >
                    Learn more about Plaid on their website
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </RowGroup>
      </section>

      {/* ── Connected Banks section (only when configured) ─────────────── */}
      {plaidConfigured && (
        <section className="space-y-2">
          <SectionHeader label="Connected Banks" />
          <RowGroup>
            {/* Environment + Add Bank row */}
            <div className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Plus className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Add a Bank</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Connect a new bank account
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Label htmlFor="plaid-env-toggle" className="text-xs text-muted-foreground cursor-pointer">
                    {plaidEnvironment === "sandbox" ? "Sandbox" : "Production"}
                  </Label>
                  <Switch
                    id="plaid-env-toggle"
                    checked={plaidEnvironment === "production"}
                    onCheckedChange={(checked) => {
                      const env = checked ? "production" : "sandbox";
                      setPlaidEnvironment(env);
                      localStorage.setItem("plaid-environment", env);
                    }}
                  />
                </div>
                <PlaidLinkButton
                  environment={plaidEnvironment}
                  onSuccess={() => loadInstitutions()}
                />
              </div>
            </div>

            {/* Loading state */}
            {isLoadingInstitutions && (
              <div className="flex items-center justify-center py-8 border-t">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty state */}
            {!isLoadingInstitutions && institutions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center border-t">
                <Building2 className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No banks connected yet</p>
                <p className="text-xs text-muted-foreground">
                  Click &quot;Add a Bank&quot; above to get started
                </p>
              </div>
            )}

            {/* Bank rows */}
            {!isLoadingInstitutions &&
              institutions.map((institution) => {
                const isExpanded = expandedBanks.has(institution.id);
                const avatarColor = bankAvatarColor(institution.institutionName);
                const initials = institution.institutionName
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase();

                return (
                  <Collapsible
                    key={institution.id}
                    open={isExpanded}
                    onOpenChange={() => toggleBank(institution.id)}
                  >
                    <div className="border-t">
                      {/* Bank header row */}
                      <div className="flex items-center gap-3 p-4">
                        {/* Bank avatar / logo */}
                        <CollapsibleTrigger asChild>
                          {(() => {
                            const logoData = getBankLogo(institution.institutionName);
                            return (
                              <div
                                className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg cursor-pointer select-none overflow-hidden",
                                  logoData ? logoData.bg : avatarColor
                                )}
                              >
                                {logoData ? (
                                  <img
                                    src={logoData.path}
                                    alt={institution.institutionName}
                                    className="h-full w-full object-contain p-1.5"
                                  />
                                ) : (
                                  <span className="text-sm font-bold">{initials}</span>
                                )}
                              </div>
                            );
                          })()}
                        </CollapsibleTrigger>

                        {/* Bank name + meta */}
                        <CollapsibleTrigger asChild>
                          <div className="flex-1 min-w-0 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{institution.institutionName}</p>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs font-medium",
                                  institution.status === "active"
                                    ? "text-green-600 dark:text-green-400"
                                    : institution.status === "login_required"
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-amber-600 dark:text-amber-400"
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    institution.status === "active"
                                      ? "bg-green-500"
                                      : institution.status === "login_required"
                                      ? "bg-red-500"
                                      : "bg-amber-500"
                                  )}
                                />
                                {institution.status === "active"
                                  ? "Active"
                                  : institution.status === "login_required"
                                  ? "Login Required"
                                  : "Error"}
                              </span>
                            </div>
                            {institution.lastSync && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Last synced: {new Date(institution.lastSync).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </CollapsibleTrigger>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {(institution.status === "login_required" ||
                            institution.status === "error") && (
                            <PlaidLinkButton
                              mode="update"
                              accessToken={institution.accessToken}
                              onSuccess={loadInstitutions}
                            />
                          )}

                          <PlaidSyncButton
                            variant="ghost"
                            size="icon"
                            itemId={institution.id}
                            bankName={institution.institutionName}
                            onSyncComplete={() => loadInstitutions()}
                          />

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingInstitution(institution)}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Bank Connection?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will disconnect {institution.institutionName} and remove all
                                  associated accounts. Portfolio accounts will not be deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteInstitution(institution.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="cursor-pointer">
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                                  isExpanded && "rotate-180"
                                )}
                              />
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>

                      {/* Accounts */}
                      <CollapsibleContent>
                        <div className="border-t bg-muted/20 divide-y divide-border">
                          {institution.accounts.length === 0 ? (
                            <p className="px-6 py-4 text-sm text-muted-foreground">
                              No accounts found
                            </p>
                          ) : (
                            institution.accounts.map((account) => {
                              const bucketConfig = BUCKET_ICONS[account.portfolioBucket || ""];
                              const BucketIcon = bucketConfig?.icon;
                              return (
                                <div
                                  key={account.id}
                                  className="flex items-center gap-3 px-4 py-3 pl-14"
                                >
                                  {/* Bucket type icon */}
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60">
                                    {BucketIcon ? (
                                      <BucketIcon className={`h-4 w-4 ${bucketConfig.color}`} />
                                    ) : (
                                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>

                                  {/* Name + subtitle */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm font-medium truncate">
                                        {account.portfolioItemName ||
                                          account.officialName ||
                                          account.name}
                                      </p>
                                      {account.mask && (
                                        <span className="text-xs text-muted-foreground font-mono shrink-0">
                                          ••{account.mask}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                                      {account.portfolioAccountId
                                        ? account.portfolioAccountName
                                        : "Unmapped"}
                                    </p>
                                  </div>

                                  {/* Balance */}
                                  {account.currentBalance != null && (
                                    <p className="text-sm font-semibold tabular-nums shrink-0">
                                      {formatCurrency(account.currentBalance)}
                                    </p>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
          </RowGroup>
        </section>
      )}

      {/* Bucket Selector Dialog */}
      <PlaidBucketSelector
        open={!!editingInstitution}
        onOpenChange={(open) => {
          if (!open) setEditingInstitution(null);
        }}
        itemId={editingInstitution?.id || 0}
        institutionName={editingInstitution?.institutionName || ""}
        accounts={
          editingInstitution?.accounts.map((acc) => ({
            id: acc.id,
            accountId: acc.id.toString(),
            name: acc.name,
            officialName: acc.officialName || undefined,
            type: acc.type,
            subtype: acc.subtype,
            mask: acc.mask || undefined,
            suggestedBucket:
              (acc.portfolioBucket as "Savings" | "Investments" | "Assets" | "Debt") ||
              "Savings",
            currentBalance: 0,
          })) || []
        }
        mode="edit"
        existingMappings={
          editingInstitution
            ? new Map(
                editingInstitution.accounts
                  .filter((acc) => acc.portfolioAccountId)
                  .map((acc) => [
                    acc.id,
                    {
                      bucket: (acc.portfolioBucket || "Savings") as
                        | "Savings"
                        | "Investments"
                        | "Assets"
                        | "Debt",
                      accountName: acc.portfolioAccountName || "",
                      itemName:
                        acc.portfolioItemName || acc.officialName || acc.name,
                    },
                  ])
              )
            : undefined
        }
        onConfirm={() => {
          setEditingInstitution(null);
          loadInstitutions();
        }}
      />
    </div>
  );
}
