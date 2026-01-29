/**
 * Plaid Link Component
 * Renders the Plaid Link button and handles the connection flow
 */

"use client";

import { useCallback, useState } from "react";
import { usePlaidLink, PlaidLinkOnSuccess, PlaidLinkOptions, PlaidLinkError, PlaidLinkOnExitMetadata } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { type PlaidEnvironmentType } from "@/lib/plaid/types";
import { PlaidBucketSelector } from "./PlaidBucketSelector";

interface PlaidAccount {
  id: number;
  accountId: string;
  name: string;
  officialName?: string | null;
  type: string;
  subtype: string;
  mask?: string | null;
  suggestedBucket: "Savings" | "Investments" | "Assets" | "Debt";
  currentBalance: number;
}

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  onExit?: () => void;
}

export function PlaidLinkButton({ onSuccess, onExit }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  
  // Always use production environment
  const environment: PlaidEnvironmentType = "production";
  
  // Bucket selector state
  const [showBucketSelector, setShowBucketSelector] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<PlaidAccount[]>([]);
  const [connectedItemId, setConnectedItemId] = useState<number>(0);
  const [connectedInstitution, setConnectedInstitution] = useState<string>("");

  // Create link token
  const createLinkToken = async () => {
    setIsCreatingToken(true);
    try {
      const response = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create link token");
      }

      const data = await response.json();
      setLinkToken(data.linkToken);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to initialize Plaid Link");
      console.error("Link token creation error:", error);
    } finally {
      setIsCreatingToken(false);
    }
  };

  // Handle successful connection
  const handleOnSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, _metadata) => {
      try {
        // Fix body scroll lock (Plaid sometimes leaves overflow: hidden)
        document.body.style.overflow = '';
        document.body.style.removeProperty('overflow');
        
        // Exchange public token for access token
        const response = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken, environment }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("Exchange token error:", errorData);
          throw new Error(errorData.error || "Failed to connect bank account");
        }

        const data = await response.json();
        
        // Small delay before showing bucket selector to ensure Plaid cleanup completes
        setTimeout(() => {
          // Double-check scroll is enabled
          document.body.style.overflow = '';
          document.body.style.removeProperty('overflow');
          
          // Show bucket selector dialog
          setConnectedAccounts(data.accounts);
          setConnectedItemId(data.item.id);
          setConnectedInstitution(data.item.institutionName);
          setShowBucketSelector(true);
        }, 300);

        // Reset link token so user can connect another bank
        setLinkToken(null);
      } catch (error: unknown) {
        const err = error as { message?: string };
        toast.error(err.message || "Failed to complete connection");
        console.error("Token exchange error:", error);
      }
    },
    [environment]
  );

  // Handle exit/cancellation
  const handleOnExit = useCallback(
    (error: PlaidLinkError | null, _metadata: PlaidLinkOnExitMetadata) => {
      // Fix body scroll lock (Plaid sometimes leaves overflow: hidden)
      document.body.style.overflow = '';
      document.body.style.removeProperty('overflow');
      
      // Additional cleanup - remove any lingering styles
      setTimeout(() => {
        document.body.style.overflow = '';
        document.body.style.removeProperty('overflow');
      }, 100);
      
      if (error) {
        toast.error("Failed to connect: " + error.error_message);
        console.error("Plaid Link error:", error);
      }
      
      // Reset link token
      setLinkToken(null);

      if (onExit) {
        onExit();
      }
    },
    [onExit]
  );

  // Configure Plaid Link
  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess: handleOnSuccess,
    onExit: handleOnExit,
  };

  const { open, ready } = usePlaidLink(config);

  // Handle button click
  const handleClick = async () => {
    if (linkToken) {
      // If we already have a token, open Plaid Link
      open();
    } else {
      // Otherwise, create a token first
      await createLinkToken();
    }
  };

  // Auto-open when token is ready
  if (linkToken && ready && !isCreatingToken) {
    setTimeout(() => open(), 100);
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={isCreatingToken || (linkToken !== null && !ready)}
      >
        {isCreatingToken ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Initializing...
            </>
          ) : linkToken && !ready ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Building2 className="h-4 w-4 mr-2" />
              Add a Bank
            </>
          )}
        </Button>

      {/* Bucket Selector Dialog */}
      <PlaidBucketSelector
        open={showBucketSelector}
        onOpenChange={setShowBucketSelector}
        accounts={connectedAccounts}
        itemId={connectedItemId}
        institutionName={connectedInstitution}
        onConfirm={() => {
          // Callback to refresh parent component
          if (onSuccess) {
            onSuccess();
          }
        }}
      />
    </>
  );
}
