"use client";

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
  return (
    <div className="flex-1 overflow-auto">
      {children}
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
