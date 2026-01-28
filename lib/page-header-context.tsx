"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";

interface PageHeaderContextType {
  title: string;
  description: string;
  actionsRef: React.MutableRefObject<ReactNode | null>;
  isScrolled: boolean;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setIsScrolled: (isScrolled: boolean) => void;
  // Force update trigger for when actions change
  actionsVersion: number;
  bumpActionsVersion: () => void;
}

const PageHeaderContext = createContext<PageHeaderContextType | undefined>(undefined);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitleState] = useState("");
  const [description, setDescriptionState] = useState("");
  const [isScrolled, setIsScrolledState] = useState(false);
  const [actionsVersion, setActionsVersion] = useState(0);
  const actionsRef = useRef<ReactNode | null>(null);

  const setTitle = useCallback((t: string) => setTitleState(t), []);
  const setDescription = useCallback((d: string) => setDescriptionState(d), []);
  const setIsScrolled = useCallback((s: boolean) => setIsScrolledState(s), []);
  const bumpActionsVersion = useCallback(() => setActionsVersion(v => v + 1), []);

  // Context value is stable - actionsRef doesn't change, only its .current does
  const contextValue: PageHeaderContextType = {
    title,
    description,
    actionsRef,
    isScrolled,
    setTitle,
    setDescription,
    setIsScrolled,
    actionsVersion,
    bumpActionsVersion,
  };

  return (
    <PageHeaderContext.Provider value={contextValue}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  const context = useContext(PageHeaderContext);
  if (context === undefined) {
    throw new Error("usePageHeader must be used within a PageHeaderProvider");
  }
  // Return actions from ref for convenience
  return {
    title: context.title,
    description: context.description,
    actions: context.actionsRef.current,
    isScrolled: context.isScrolled,
    actionsVersion: context.actionsVersion,
  };
}

// Hook for setting page header values (used by pages)
export function useSetPageHeader(title: string, actions?: ReactNode) {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error("useSetPageHeader must be used within a PageHeaderProvider");
  }

  const { setTitle, actionsRef, setIsScrolled, bumpActionsVersion } = context;
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

  // Callback ref to capture the sentinel element
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    setSentinel(node);
  }, []);

  // Register title with context
  useEffect(() => {
    setTitle(title);
    return () => setTitle("");
  }, [title, setTitle]);

  // Set actions via ref (doesn't trigger re-renders)
  useEffect(() => {
    actionsRef.current = actions || null;
    // Don't bump version here - it causes infinite loops
    // Version is only used for manual refresh if needed
    return () => {
      actionsRef.current = null;
    };
  }, [actions, actionsRef]);

  // Set up intersection observer - triggers when page header scrolls out of view
  useEffect(() => {
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When sentinel is NOT intersecting (scrolled past), show sticky header
        setIsScrolled(!entry.isIntersecting);
      },
      {
        root: null, // Use viewport - works regardless of which element scrolls
        threshold: 0,
        rootMargin: "-57px 0px 0px 0px", // Account for sticky header height (h-14 = 56px + 1px border)
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, setIsScrolled]);

  return sentinelRef;
}

// Component for page header - renders title, description, actions and the sentinel
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const sentinelRef = useSetPageHeader(title, actions);

  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
        {/* Sentinel - when this goes out of view, sticky header appears */}
        <div ref={sentinelRef} className="h-0" />
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
