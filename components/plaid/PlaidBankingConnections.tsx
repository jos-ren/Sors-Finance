/**
 * Plaid Banking Connections Component
 * Step-based UI for Plaid setup and management
 */

"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from "react";
import {
  Building2,
  Check,
  X,
  AlertTriangle,
  ExternalLink,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  CheckCircle2,
  Circle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { PLAID_SETTINGS_KEYS, type PlaidEnvironmentType, getCredentialKeys } from "@/lib/plaid/types";
import { setSetting } from "@/lib/db/client";
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

export function PlaidBankingConnections() {
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [hasCredentials, setHasCredentials] = useState(false);
  
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [institutions, setInstitutions] = useState<PlaidInstitution[]>([]);
  const [isLoadingInstitutions, setIsLoadingInstitutions] = useState(false);
  const [encryptionConfigured, setEncryptionConfigured] = useState<boolean | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string>("");
  const [editingInstitution, setEditingInstitution] = useState<PlaidInstitution | null>(null);
  
  // Collapsible states
  const [step1Open, setStep1Open] = useState(true);
  const [step2Open, setStep2Open] = useState(false);

  // Check encryption status
  const checkEncryptionStatus = async () => {
    try {
      const response = await fetch("/api/plaid/encryption-status");
      const data = await response.json();
      setEncryptionConfigured(data.configured);
    } catch (error) {
      console.error("Failed to check encryption status:", error);
      setEncryptionConfigured(false);
    }
  };

  // Load credentials from settings
  const loadCredentials = async () => {
    try {
      const response = await fetch("/api/settings");
      const result = await response.json();
      const settings = result.data || result; // Handle both formats
      
      const keys = getCredentialKeys();
      const hasClientId = !!settings[keys.clientId];
      const hasSecret = !!settings[keys.secret];
      
      // Don't load encrypted values into inputs - just show that credentials exist
      setClientId(hasClientId ? "••••••••••••••••••••" : "");
      setSecret(hasSecret ? "••••••••••••••••••••" : "");
      setHasCredentials(hasClientId && hasSecret);
    } catch (error) {
      console.error("Failed to load credentials:", error);
    }
  };

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
    checkEncryptionStatus();
    loadCredentials();
    loadInstitutions();
  }, []);

  // Auto-collapse/expand based on progress
  useEffect(() => {
    if (encryptionConfigured && !hasCredentials) {
      // Step 1 done, working on Step 2
      setStep1Open(false);
      setStep2Open(true);
    } else if (hasCredentials) {
      // Step 2 done, working on Step 3
      setStep1Open(false);
      setStep2Open(false);
    }
  }, [encryptionConfigured, hasCredentials]);

  // Generate encryption key
  const generateEncryptionKey = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const key = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    setGeneratedKey(key);
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  // Test credentials (default to sandbox for testing)
  const handleTestCredentials = async () => {
    setIsTesting(true);
    try {
      const response = await fetch("/api/plaid/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          secret,
          environment: "sandbox", // Test with sandbox by default
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success("Credentials are valid!");
      } else {
        toast.error(data.error || "Invalid credentials");
      }
    } catch (error) {
      toast.error("Failed to test credentials");
    } finally {
      setIsTesting(false);
    }
  };

  // Save credentials
  const handleSaveCredentials = async () => {
    setIsSaving(true);
    try {
      if (!clientId || !secret) {
        toast.error("Please fill in both Client ID and Secret");
        return;
      }

      // Encrypt credentials on server
      const encryptResponse = await fetch("/api/plaid/encrypt-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          secret,
        }),
      });

      if (!encryptResponse.ok) {
        throw new Error("Failed to encrypt credentials");
      }

      const { encryptedClientId, encryptedSecret } = await encryptResponse.json();

      // Save encrypted credentials
      const keys = getCredentialKeys();
      await setSetting(keys.clientId, encryptedClientId);
      await setSetting(keys.secret, encryptedSecret);

      toast.success("Credentials saved and encrypted!");
      
      // Update state to show credentials are saved
      setHasCredentials(true);
      
      // Show masked values
      setClientId("••••••••••••••••••••");
      setSecret("••••••••••••••••••••");
    } catch (error) {
      toast.error("Failed to save credentials");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete credentials
  const handleDeleteCredentials = async () => {
    try {
      const keys = getCredentialKeys();
      await setSetting(keys.clientId, "");
      await setSetting(keys.secret, "");
      
      setClientId("");
      setSecret("");
      setHasCredentials(false);

      toast.success("Credentials deleted");
    } catch (error) {
      toast.error("Failed to delete credentials");
    }
  };

  // Sync balances
  // Disconnect institution
  const handleDisconnect = async (itemId: number) => {
    try {
      const response = await fetch(`/api/plaid/items/${itemId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Institution disconnected");
        await loadInstitutions();
      } else {
        toast.error("Failed to disconnect");
      }
    } catch (error) {
      toast.error("Failed to disconnect");
    }
  };

  // Progress steps
  const hasConnectedBanks = institutions.length > 0;
  const steps = [
    {
      number: 1,
      title: "Encryption Key",
      completed: encryptionConfigured === true,
    },
    {
      number: 2,
      title: "API Credentials",
      completed: hasCredentials,
    },
    {
      number: 3,
      title: "Connect Banks",
      completed: hasConnectedBanks,
    },
  ];

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <img
            src="/logos/plaid.png"
            alt="Plaid"
            className="h-5 w-auto object-contain"
          />
          Plaid
        </CardTitle>
        <CardDescription className="space-y-2">
          <p>
            Plaid connects your bank accounts to automatically import transactions and sync account balances. 
            This gives you a real-time view of your finances without manual data entry.
          </p>
          <p className="text-xs">
            <strong>What you'll need:</strong> A free Plaid developer account. You'll use your own API credentials, 
            so you control your data and API usage. Perfect for self-hosted personal finance tracking.
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex items-center gap-2 flex-1">
                {step.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="flex flex-col">
                  <span className={`text-sm font-medium ${step.completed ? "text-green-600" : "text-foreground"}`}>
                    Step {step.number}
                  </span>
                  <span className="text-xs text-muted-foreground">{step.title}</span>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-[2px] flex-1 mx-2 ${steps[index + 1].completed ? "bg-green-600" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Encryption Key */}
        <Collapsible open={step1Open} onOpenChange={setStep1Open}>
          <div className={`rounded-lg border-2 ${encryptionConfigured ? "border-green-600" : "border-border"}`}>
            <CollapsibleTrigger asChild>
              <div className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {encryptionConfigured ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center text-xs font-bold">1</div>
                    )}
                    <div>
                      <h3 className="font-semibold">
                        {encryptionConfigured ? "Encryption Key Configured" : "Step 1: Generate Encryption Key"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {encryptionConfigured 
                          ? "Your encryption key is set up and ready" 
                          : "Required to securely store your Plaid credentials"}
                      </p>
                    </div>
                  </div>
                  {step1Open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4">
                {encryptionConfigured === false ? (
                  <>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Encryption Key Required</AlertTitle>
                      <AlertDescription>
                        Generate a secure encryption key to protect your Plaid credentials.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Click the button below to generate a cryptographically secure encryption key.
                        </p>
                        <Button onClick={generateEncryptionKey} variant="outline" className="w-full">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Generate Encryption Key
                        </Button>
                      </div>

                      {generatedKey && (
                        <div className="space-y-3 p-4 bg-accent rounded-lg">
                          <Label>Your Encryption Key</Label>
                          <div className="flex gap-2">
                            <Input
                              value={generatedKey}
                              readOnly
                              className="font-mono text-xs"
                            />
                            <Button
                              onClick={() => copyToClipboard(generatedKey)}
                              size="icon"
                              variant="outline"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <Alert>
                            <AlertDescription className="text-sm space-y-2">
                              <p className="font-semibold">Next Steps:</p>
                              <ol className="list-decimal list-inside space-y-1 ml-2">
                                <li>Copy the key above</li>
                                <li>Add it to your <code className="bg-muted px-1 py-0.5 rounded">.env.local</code> file as:
                                  <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
                                    PLAID_ENCRYPTION_KEY=your_64_character_hex_key_here
                                  </pre>
                                </li>
                                <li>Restart your development server: <code className="bg-muted px-1 py-0.5 rounded">npm run dev</code></li>
                                <li>Refresh this page</li>
                              </ol>
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <Alert className="border-green-600 bg-green-50 dark:bg-green-950">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-600">Encryption Configured</AlertTitle>
                    <AlertDescription className="text-green-600">
                      Your encryption key is active and protecting your credentials.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Step 2: API Credentials */}
        <Collapsible open={step2Open} onOpenChange={setStep2Open}>
          <div className={`rounded-lg border-2 ${hasCredentials ? "border-green-600" : "border-border"}`}>
            <CollapsibleTrigger asChild>
              <div className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {hasCredentials ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : encryptionConfigured ? (
                      <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center text-xs font-bold">2</div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground flex items-center justify-center text-xs font-bold text-muted-foreground">2</div>
                    )}
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {hasCredentials ? "API Credentials Configured" : "Step 2: Add Plaid API Credentials"}
                        {!encryptionConfigured && (
                          <Badge variant="outline" className="text-xs">Complete Step 1 First</Badge>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {hasCredentials 
                          ? "Your credentials are saved and encrypted" 
                          : "Get your API keys from dashboard.plaid.com"}
                      </p>
                    </div>
                  </div>
                  {step2Open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4">
                {!encryptionConfigured ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Complete Step 1 (Encryption Key) before adding API credentials.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Alert>
                      <ExternalLink className="h-4 w-4" />
                      <AlertTitle>Get Your Plaid API Keys</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>1. Sign up for a free account at <a href="https://dashboard.plaid.com/signup" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">dashboard.plaid.com</a></p>
                        <p>2. Navigate to Platform → Developers → Keys</p>
                        <p>3. Copy your <strong>client_id</strong> and <strong>secret</strong></p>
                        <p className="text-xs text-muted-foreground mt-2">
                          <strong>Which keys to use:</strong> We recommend Development keys, which connect to your real bank accounts with up to 2 years of transaction history. Sandbox keys use fake banks with demo data (testing only), while Production keys require Plaid approval and are intended for commercial apps.
                        </p>
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="client-id" className="mb-2 block">Client ID</Label>
                        <Input
                          id="client-id"
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value)}
                          placeholder="Enter Plaid Client ID"
                          disabled={hasCredentials}
                        />
                      </div>
                      <div>
                        <Label htmlFor="secret" className="mb-2 block">Secret</Label>
                        <Input
                          id="secret"
                          type="password"
                          value={secret}
                          onChange={(e) => setSecret(e.target.value)}
                          placeholder="Enter Plaid Secret"
                          disabled={hasCredentials}
                        />
                      </div>
                      {hasCredentials && (
                        <Alert>
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-sm flex items-center justify-between">
                            <span>Credentials are saved and encrypted.</span>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setClientId("");
                                setSecret("");
                                setHasCredentials(false);
                              }}
                            >
                              Edit Credentials
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveCredentials}
                        disabled={isSaving || !clientId || !secret || hasCredentials}
                        className="flex-1"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Credentials"
                        )}
                      </Button>
                      <Button
                        onClick={handleTestCredentials}
                        disabled={!clientId || !secret || isTesting || hasCredentials}
                        variant="outline"
                      >
                        {isTesting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                      {hasCredentials && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Credentials?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove your saved Plaid credentials. You'll need to re-enter them to use Plaid.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteCredentials}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Step 3: Connect Banks */}
        {hasCredentials && (
          <div className={`rounded-lg border-2 ${hasConnectedBanks ? "border-green-600" : "border-border"}`}>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                {hasConnectedBanks ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center text-xs font-bold">3</div>
                )}
                <div>
                  <h3 className="font-semibold">
                    {hasConnectedBanks ? `${institutions.length} Bank${institutions.length !== 1 ? 's' : ''} Connected` : "Step 3: Connect Your Banks"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {hasConnectedBanks 
                      ? "Your banks are connected and syncing" 
                      : "Use Plaid Link to securely connect your bank accounts"}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <PlaidLinkButton
                    onSuccess={loadInstitutions}
                    hasCredentials={true}
                  />
                  <Button
                    onClick={loadInstitutions}
                    variant="outline"
                    size="icon"
                    disabled={isLoadingInstitutions}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingInstitutions ? "animate-spin" : ""}`} />
                  </Button>
                </div>

                {/* Connected Institutions */}
                {institutions.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Connected Institutions</h4>
                    {institutions.map((institution) => (
                      <div key={institution.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{institution.institutionName}</p>
                              </div>
                              <div className="space-y-0.5">
                                {institution.accounts.map((account) => (
                                  <div key={account.id} className="flex items-center justify-between gap-4">
                                    <p className="text-sm text-muted-foreground flex-shrink">
                                      {account.officialName || account.name} ({account.type})
                                      {account.mask && ` ••${account.mask}`}
                                    </p>
                                    {account.portfolioAccountId ? (
                                      <div className="text-xs flex flex-col leading-tight flex-shrink-0 items-end">
                                        <span className="text-muted-foreground">{account.portfolioBucket}</span>
                                        <span className="text-[10px] text-muted-foreground/60">{account.portfolioAccountName}</span>
                                      </div>
                                    ) : (
                                      <div className="text-xs text-muted-foreground flex-shrink-0">
                                        No Account Yet
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setEditingInstitution(institution)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Disconnect {institution.institutionName}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove the connection and all associated accounts from your portfolio.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDisconnect(institution.id)}>
                                    Disconnect
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Edit Institution Dialog */}
    {editingInstitution && (
      <PlaidBucketSelector
        open={!!editingInstitution}
        onOpenChange={(open) => !open && setEditingInstitution(null)}
        accounts={editingInstitution.accounts.map(acc => ({
          id: acc.id,
          accountId: acc.id.toString(),
          name: acc.name,
          officialName: acc.officialName || null,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask || null,
          suggestedBucket: (acc.portfolioBucket as any) || 'Savings',
          currentBalance: 0,
        }))}
        itemId={editingInstitution.id}
        institutionName={editingInstitution.institutionName}
        onConfirm={() => {
          loadInstitutions();
          setEditingInstitution(null);
        }}
        mode="edit"
        existingMappings={new Map(
          editingInstitution.accounts
            .filter(acc => acc.portfolioAccountId && acc.portfolioAccountName)
            .map(acc => [
              acc.id,
              {
                bucket: (acc.portfolioBucket as any) || 'Savings',
                accountName: acc.portfolioAccountName || '',
                itemName: acc.portfolioItemName || '',
              }
            ])
        )}
      />
    )}
  </>
  );
}
