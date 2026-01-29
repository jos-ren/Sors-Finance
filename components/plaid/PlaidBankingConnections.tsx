/**
 * Plaid Banking Connections Component
 * Simplified UI showing configuration status and bank management
 */

"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from "react";
import {
  Building2,
  Check,
  AlertTriangle,
  ExternalLink,
  Trash2,
  Loader2,
  Monitor,
  Pencil,
  Info,
  PiggyBank,
  TrendingUp,
  Home,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { type PlaidEnvironmentType } from "@/lib/plaid/types";
import { PlaidLinkButton } from "./PlaidLinkButton";
import { PlaidBucketSelector } from "./PlaidBucketSelector";

interface PlaidInstitution {
  id: number;
  institutionName: string;
  institutionId: string;
  status: string;
  lastSync?: Date;
  environment: PlaidEnvironmentType;
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
  }>;
}

const BUCKET_ICONS: Record<string, { icon: typeof PiggyBank; color: string }> = {
  Savings: { icon: PiggyBank, color: "text-emerald-500" },
  Investments: { icon: TrendingUp, color: "text-blue-500" },
  Assets: { icon: Home, color: "text-amber-500" },
  Debt: { icon: CreditCard, color: "text-red-500" },
};

interface PlaidBankingConnectionsProps {
  plaidConfigured: boolean | null;
}

export function PlaidBankingConnections({ plaidConfigured }: PlaidBankingConnectionsProps) {
  const [institutions, setInstitutions] = useState<PlaidInstitution[]>([]);
  const [isLoadingInstitutions, setIsLoadingInstitutions] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<PlaidInstitution | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Load connected institutions
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

  // Test API credentials
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
    } catch (error) {
      console.error("Test error:", error);
      toast.error("Failed to test credentials");
    } finally {
      setIsTesting(false);
    }
  };

  // Delete institution
  const handleDeleteInstitution = async (itemId: number) => {
    try {
      const response = await fetch(`/api/plaid/items/${itemId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Bank connection removed");
        await loadInstitutions();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to remove bank connection");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to remove bank connection");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <img
            src="/logos/plaid.png"
            alt="Plaid"
            className="h-5 w-auto object-contain"
          />
          Plaid Banking Integration
        </CardTitle>
        <CardDescription className="space-y-2">
          <p>
            Connect your bank accounts to automatically import transactions and sync balances.
            Supports thousands of banks worldwide.
          </p>
          <a
            href="https://plaid.com/docs/quickstart/#introduction"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-lime-600 hover:text-lime-700 dark:text-lime-400 dark:hover:text-lime-300"
          >
            Learn more about Plaid
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Section */}
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-2">
            {plaidConfigured === null ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Checking configuration...</span>
              </>
            ) : plaidConfigured ? (
              <>
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-600 dark:text-green-400">Configured</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <span className="font-medium text-amber-600 dark:text-amber-400">Not Configured</span>
              </>
            )}
          </div>
          {plaidConfigured && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestCredentials}
              disabled={isTesting}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
          )}
        </div>

        {/* Production Note */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm space-y-2">
            <div>
              <strong>Production API Keys Required</strong>
              <p className="text-muted-foreground text-xs mt-1">
                Plaid offers Sandbox (test) and Production modes. Sandbox environments cannot import real transactions.
                Use Production keys to connect actual bank accounts.
              </p>
            </div>
            <div>
              <strong>Required Plaid Scopes</strong>
              <p className="text-muted-foreground text-xs mt-1">
                When creating your Plaid application, you must enable these scopes:
              </p>
              <ul className="text-muted-foreground text-xs list-disc list-inside ml-2 mt-1">
                <li><strong>Transactions:</strong> Import and categorize bank transactions ($0.30 per account per month)</li>
                <li><strong>Balance:</strong> Sync current account balances ($0.10 per API call)</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        {/* Configuration Instructions */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Setup Instructions:</p>

          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium mb-1 flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Local Development & Docker CLI
              </p>
              <ol className="text-sm space-y-1 list-decimal list-inside ml-6 text-muted-foreground">
                <li>Create a free account at <a href="https://dashboard.plaid.com" target="_blank" rel="noopener noreferrer" className="text-lime-600 hover:underline">dashboard.plaid.com</a></li>
                <li>Get your <code className="bg-muted px-1 py-0.5 rounded">client_id</code> and <code className="bg-muted px-1 py-0.5 rounded">secret</code></li>
                <li>Add to your <code className="bg-muted px-1 py-0.5 rounded">.env</code> file:
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
PLAID_CLIENT_ID=your_client_id_here{"\n"}PLAID_SECRET=your_secret_here
                  </pre>
                </li>
                <li>Restart the server</li>
              </ol>
            </div>

            <div>
              <p className="text-sm font-medium mb-1 flex items-center gap-2">
                <img src="/logos/docker.png" alt="Docker" className="h-4 w-4" />
                Docker UI/Portainer
              </p>
              <p className="text-sm ml-6 text-muted-foreground">
                Add these variables in your stack&apos;s Environment Variables section:
              </p>
              <ul className="text-sm list-disc list-inside ml-10 mt-1 text-muted-foreground">
                <li><code className="bg-muted px-1 py-0.5 rounded">PLAID_CLIENT_ID</code></li>
                <li><code className="bg-muted px-1 py-0.5 rounded">PLAID_SECRET</code></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Configuration Status */}
        {plaidConfigured === null ? (
          null
        ) : plaidConfigured ? (
          <>
            {/* Bank Connections Section */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Connected Banks</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your connected bank accounts
                  </p>
                </div>
                <div className="flex gap-2">
                  <PlaidLinkButton
                    onSuccess={() => {
                      // Institutions will refresh when bucket mapping is confirmed
                    }}
                  />
                </div>
              </div>

              {isLoadingInstitutions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : institutions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No banks connected yet</p>
                  <p className="text-sm">Click &quot;Add a Bank&quot; to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {institutions.map((institution) => (
                    <div
                      key={institution.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      {/* Title Row with Action Buttons */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold">
                            {institution.institutionName}
                          </h4>
                          <Badge variant={
                            institution.status === "active" ? "default" :
                            institution.status === "login_required" ? "destructive" :
                            "secondary"
                          }>
                            {institution.status === "active" ? "Active" :
                             institution.status === "login_required" ? "Login Required" :
                             "Error"}
                          </Badge>
                        </div>

                        <div className="flex gap-1">
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
                                <AlertDialogTitle>
                                  Remove Bank Connection?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will disconnect {institution.institutionName}{" "}
                                  and remove all associated accounts. Portfolio
                                  accounts will not be deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleDeleteInstitution(institution.id)
                                  }
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {/* Last Sync Info */}
                      {institution.lastSync && (
                        <p className="text-sm text-muted-foreground">
                          Last synced:{" "}
                          {new Date(institution.lastSync).toLocaleString()}
                        </p>
                      )}

                      {/* Accounts */}
                      <div className="space-y-2">
                        {institution.accounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded"
                          >
                            <div>
                              <p className="font-medium text-sm">
                                {account.portfolioItemName || account.officialName || account.name}
                                {account.mask && ` ••${account.mask}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {account.portfolioAccountId ? (() => {
                                const config = BUCKET_ICONS[account.portfolioBucket || ""];
                                const Icon = config?.icon;
                                return (
                                  <Badge variant="secondary" className="text-xs gap-1">
                                    {Icon && <Icon className={`h-3 w-3 ${config.color}`} />}
                                    {account.portfolioAccountName}
                                  </Badge>
                                );
                              })() : (
                                <Badge
                                  variant="secondary"
                                  className="text-xs text-amber-900 dark:text-amber-200"
                                  style={{ backgroundColor: "oklch(0.77 0.16 70 / 0.4)" }}
                                >
                                  Needs Mapping
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </CardContent>

      {/* Bucket Selector Dialog */}
      <PlaidBucketSelector
        open={!!editingInstitution}
        onOpenChange={(open) => {
          if (!open) {
            setEditingInstitution(null);
            // Don't refresh here - will refresh in onConfirm if user saved changes
          }
        }}
        itemId={editingInstitution?.id || 0}
        institutionName={editingInstitution?.institutionName || ""}
        accounts={editingInstitution?.accounts.map((acc) => ({
          id: acc.id,
          accountId: acc.id.toString(),
          name: acc.name,
          officialName: acc.officialName || undefined,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask || undefined,
          suggestedBucket: (acc.portfolioBucket as "Savings" | "Investments" | "Assets" | "Debt") || "Savings",
          currentBalance: 0,
        })) || []}
        mode="edit"
        existingMappings={
          editingInstitution
            ? new Map(
                editingInstitution.accounts
                  .filter((acc) => acc.portfolioAccountId)
                  .map((acc) => [
                    acc.id,
                    {
                      bucket: (acc.portfolioBucket || "Savings") as "Savings" | "Investments" | "Assets" | "Debt",
                      accountName: acc.portfolioAccountName || "",
                      itemName: acc.portfolioItemName || acc.officialName || acc.name,
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
    </Card>
  );
}
