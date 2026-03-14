"use client";

import { createContext, useContext, RefObject } from "react";

export const VirtualScrollContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function useVirtualScroll() {
  return useContext(VirtualScrollContext);
}
