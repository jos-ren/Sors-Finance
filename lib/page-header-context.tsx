"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface PageHeaderContextType {
  title: string;
  description: string;
  actions: ReactNode | null;
  isScrolled: boolean;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setActions: (actions: ReactNode | null) => void;
  setIsScrolled: (isScrolled: boolean) => void;
}

const PageHeaderContext = createContext<PageHeaderContextType | undefined>(undefined);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actions, setActions] = useState<ReactNode | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  return (
    <PageHeaderContext.Provider
      value={{
        title,
        description,
        actions,
        isScrolled,
        setTitle: useCallback((t: string) => setTitle(t), []),
        setDescription: useCallback((d: string) => setDescription(d), []),
        setActions: useCallback((a: ReactNode | null) => setActions(a), []),
        setIsScrolled: useCallback((s: boolean) => setIsScrolled(s), []),
      }}
    >
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  const context = useContext(PageHeaderContext);
  if (context === undefined) {
    throw new Error("usePageHeader must be used within a PageHeaderProvider");
  }
  return context;
}

// Hook for setting page header values (used by pages)
export function useSetPageHeader(title: string, actions?: ReactNode) {
  const { setTitle, setActions, setIsScrolled } = usePageHeader();
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

  // Callback ref to capture the sentinel element
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    setSentinel(node);
  }, []);

  // Register title and actions with context
  useEffect(() => {
    setTitle(title);
    return () => setTitle("");
  }, [title, setTitle]);

  useEffect(() => {
    setActions(actions || null);
    return () => setActions(null);
  }, [actions, setActions]);

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
