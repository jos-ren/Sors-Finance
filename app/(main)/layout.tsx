"use client";

import { useEffect, useRef } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/mode-toggle";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { PageHeaderProvider, usePageHeader } from "@/lib/page-header-context";
import { UnsavedChangesProvider } from "@/lib/unsaved-changes-context";
import { SettingsProvider } from "@/lib/settings-context";
import { SnapshotProvider } from "@/lib/snapshot-context";
import { useAuth } from "@/lib/auth-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function HeaderContent() {
  const { title, actions, isScrolled } = usePageHeader();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger className="-ml-1" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Toggle sidebar</TooltipContent>
      </Tooltip>

      {/* Title - shows when scrolled with fade animation */}
      <h2
        className={`text-sm font-semibold whitespace-nowrap transition-opacity duration-200 ${
          isScrolled && title ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {title}
      </h2>

      <div className="flex-1" />

      {/* Right side items with separator - fixed height container for proper separator alignment */}
      <div className="flex items-center gap-2 h-5">
        {/* Actions - show when scrolled with fade animation */}
        <div
          className={`flex items-center gap-1 transition-opacity duration-200 ${
            isScrolled && actions ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {actions}
        </div>

        <Separator
          orientation="vertical"
          className={`ml-2 transition-opacity duration-200 ${
            isScrolled && actions ? "opacity-100" : "opacity-0"
          }`}
        />

        <PrivacyToggle />
        <ModeToggle />
      </div>
    </header>
  );
}

function ScrollableContent({ children }: { children: React.ReactNode }) {
  const hasRunToday = useRef(false);

  useEffect(() => {
    // First load snapshot check - run once per day
    const checkFirstLoadSnapshot = async () => {
      // Check localStorage for last snapshot check date
      const lastCheckDate = localStorage.getItem("lastSnapshotCheck");
      const today = new Date().toDateString();

      if (lastCheckDate === today || hasRunToday.current) {
        return; // Already checked today
      }

      hasRunToday.current = true;
      localStorage.setItem("lastSnapshotCheck", today);

      console.log("[First Load] Triggering snapshot check for today");

      // Call the snapshot endpoint with settings check
      try {
        const response = await fetch("/api/portfolio/snapshots/first-load", {
          method: "POST",
        });

        if (response.ok) {
          console.log("[First Load] Snapshot check completed");
        } else {
          console.error("[First Load] Snapshot check failed:", await response.text());
        }
      } catch (error) {
        console.error("[First Load] Error during snapshot check:", error);
      }
    };

    // Run after a short delay to ensure everything is loaded
    const timer = setTimeout(checkFirstLoadSnapshot, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-1 overflow-auto">
      {children}
      {/* Breathing room at the bottom of every page */}
      <div className="h-16" />
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <SettingsProvider>
      <SnapshotProvider>
        <UnsavedChangesProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <PageHeaderProvider>
                <HeaderContent />
                <ScrollableContent>{children}</ScrollableContent>
              </PageHeaderProvider>
            </SidebarInset>
          </SidebarProvider>
        </UnsavedChangesProvider>
      </SnapshotProvider>
    </SettingsProvider>
  );
}
