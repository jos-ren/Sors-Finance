"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** A Home card's title, doubling as the way into the page that owns it. */
export function CardTitleLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 text-base font-medium text-foreground/90 transition-colors hover:text-foreground"
    >
      {children}
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}
