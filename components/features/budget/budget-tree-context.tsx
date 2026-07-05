"use client";

import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";

/**
 * Registry that lets planned inputs move focus to the next input on Enter.
 * The tree registers each item's input in visual order; focusNext jumps to the
 * next registered input (planned inputs are the only tabbable elements).
 */
interface InputRegistry {
  register: (itemId: number, el: HTMLInputElement | null) => void;
  setOrder: (ids: number[]) => void;
  focusNext: (itemId: number) => void;
  focus: (itemId: number) => void;
}

const Ctx = createContext<InputRegistry | null>(null);

export function BudgetTreeInputProvider({ children }: { children: ReactNode }) {
  const refs = useRef(new Map<number, HTMLInputElement>());
  const order = useRef<number[]>([]);

  const register = useCallback((itemId: number, el: HTMLInputElement | null) => {
    if (el) refs.current.set(itemId, el);
    else refs.current.delete(itemId);
  }, []);

  const setOrder = useCallback((ids: number[]) => {
    order.current = ids;
  }, []);

  const focusNext = useCallback((itemId: number) => {
    const idx = order.current.indexOf(itemId);
    for (let i = idx + 1; i < order.current.length; i++) {
      const el = refs.current.get(order.current[i]);
      if (el && !el.disabled) {
        el.focus();
        el.select();
        return;
      }
    }
  }, []);

  const focus = useCallback((itemId: number) => {
    const el = refs.current.get(itemId);
    if (el) {
      el.focus();
      el.select();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, []);

  return <Ctx.Provider value={{ register, setOrder, focusNext, focus }}>{children}</Ctx.Provider>;
}

export function useBudgetTreeInputs(): InputRegistry {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBudgetTreeInputs must be used within BudgetTreeInputProvider");
  return ctx;
}
