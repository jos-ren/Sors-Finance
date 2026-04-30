import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const iconBadgeVariants = cva(
  "flex shrink-0 items-center justify-center overflow-hidden",
  {
    variants: {
      size: {
        sm: "h-7 w-7",
        md: "h-8 w-8",
        lg: "h-9 w-9",
        xl: "h-12 w-12",
      },
      radius: {
        md: "rounded-md",
        lg: "rounded-lg",
        xl: "rounded-xl",
      },
      bg: {
        muted: "bg-muted",
        "muted/60": "bg-muted/60",
      },
    },
    defaultVariants: {
      size: "md",
      radius: "md",
      bg: "muted/60",
    },
  }
)

export interface IconBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconBadgeVariants> {
  pip?: React.ReactNode;
}

export function IconBadge({ size, radius, bg, className, pip, children, ...props }: IconBadgeProps) {
  if (pip) {
    return (
      <div className="relative shrink-0">
        <div
          className={cn(iconBadgeVariants({ size, radius, bg }), className)}
          {...props}
        >
          {children}
        </div>
        <div className="absolute -bottom-1 -right-1">{pip}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(iconBadgeVariants({ size, radius, bg }), className)}
      {...props}
    >
      {children}
    </div>
  );
}
