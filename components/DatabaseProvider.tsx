"use client";

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useInitDatabase } from '@/lib/hooks/useDatabase';

interface DatabaseContextType {
  isReady: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextType>({
  isReady: false,
  error: null
});

export function useDatabaseContext() {
  return useContext(DatabaseContext);
}

interface DatabaseProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function DatabaseProvider({ children, fallback }: DatabaseProviderProps) {
  const { isReady, error } = useInitDatabase();

  const contextValue = useMemo(
    () => ({ isReady, error }),
    [isReady, error]
  );

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6">
          <h2 className="text-xl font-semibold text-destructive mb-2">Database Error</h2>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <>
        {fallback || (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center p-6">
              <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  );
}
