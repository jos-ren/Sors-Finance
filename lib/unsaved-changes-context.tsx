"use client";

import { createContext, useContext, useState, useCallback, ReactNode, Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type SaveHandler = (() => Promise<void>) | null;

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  saveHandler: SaveHandler;
  setSaveHandler: Dispatch<SetStateAction<SaveHandler>>;
  navigateWithCheck: (href: string) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveHandler, setSaveHandler] = useState<SaveHandler>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const navigateWithCheck = useCallback((href: string) => {
    if (hasUnsavedChanges) {
      setPendingHref(href);
      setShowDialog(true);
    } else {
      router.push(href);
    }
  }, [hasUnsavedChanges, router]);

  const handleDiscard = useCallback(() => {
    setHasUnsavedChanges(false);
    setSaveHandler(null);
    setShowDialog(false);
    if (pendingHref) {
      router.push(pendingHref);
      setPendingHref(null);
    }
  }, [pendingHref, router]);

  const handleSaveAndContinue = useCallback(async () => {
    if (saveHandler) {
      await saveHandler();
    }
    setHasUnsavedChanges(false);
    setSaveHandler(null);
    setShowDialog(false);
    if (pendingHref) {
      router.push(pendingHref);
      setPendingHref(null);
    }
  }, [saveHandler, pendingHref, router]);

  return (
    <UnsavedChangesContext.Provider
      value={{
        hasUnsavedChanges,
        setHasUnsavedChanges,
        saveHandler,
        setSaveHandler,
        navigateWithCheck,
      }}
    >
      {children}

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved budget changes. Would you like to save them before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleDiscard}>
              Discard Changes
            </Button>
            <AlertDialogAction onClick={handleSaveAndContinue}>
              Save & Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  }
  return context;
}
