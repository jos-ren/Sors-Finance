"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  DollarSign,
  Tags,
  TrendingUp,
  PiggyBank,
  Home,
  CreditCard,
  BarChart3,
  ChevronRight,
  Settings,
  Loader2,
} from "lucide-react";
import { useUnsavedChanges } from "@/lib/unsaved-changes-context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { useSnapshot } from "@/lib/snapshot-context";

const navItems = [
  {
    title: "Budget",
    url: "/budget",
    icon: Wallet,
  },
  {
    title: "Categories",
    url: "/categories",
    icon: Tags,
  },
  {
    title: "Transactions",
    url: "/transactions",
    icon: Receipt,
  },
];

const portfolioSubItems = [
  { title: "Overview", url: "/portfolio", icon: BarChart3 },
  { title: "Savings", url: "/portfolio/savings", icon: PiggyBank },
  { title: "Investments", url: "/portfolio/investments", icon: TrendingUp },
  { title: "Assets", url: "/portfolio/assets", icon: Home },
  { title: "Debt", url: "/portfolio/debt", icon: CreditCard },
];

// Custom link component that checks for unsaved changes
function NavLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const { navigateWithCheck } = useUnsavedChanges();

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        navigateWithCheck(href);
      }}
    >
      {children}
    </a>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { progress, isSnapshotInProgress } = useSnapshot();

  const progressPercent = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group-data-[collapsible=icon]:mt-1 group-data-[collapsible=icon]:-mb-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink href="/">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Sors</span>
                  <span className="text-xs text-muted-foreground">Budget Tracking Tool</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dashboard */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/"}
                  tooltip="Dashboard"
                >
                  <NavLink href="/">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Budget, Transactions, Categories */}
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.url === "/" ? pathname === "/" : pathname.startsWith(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Portfolio with collapsible sub-items */}
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/portfolio")}
                      tooltip="Portfolio"
                    >
                      <TrendingUp />
                      <span>Portfolio</span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {portfolioSubItems.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname === item.url}
                          >
                            <NavLink href={item.url}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {/* Snapshot Progress Indicator */}
        {isSnapshotInProgress && (
          <div className="px-3 py-2 group-data-[collapsible=icon]:px-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground group-data-[collapsible=icon]:justify-center">
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden truncate">
                Updating prices...
              </span>
            </div>
            <div className="mt-1 group-data-[collapsible=icon]:hidden">
              <Progress value={progressPercent} className="h-1" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>{progress.currentTicker}</span>
                <span>{progress.completed}/{progress.total}</span>
              </div>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith("/settings")}
              tooltip="Settings"
            >
              <NavLink href="/settings">
                <Settings />
                <span>Settings</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
