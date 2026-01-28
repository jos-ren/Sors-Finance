import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends Omit<React.ComponentProps<"input">, "size"> {
  size?: "sm" | "default"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, autoComplete, size: inputSize = "default", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        data-slot="input"
        data-size={inputSize}
        autoComplete={autoComplete ?? "off"}
        data-lpignore="true"
        data-1p-ignore
        data-form-type="other"
        className={cn(
          "bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 data-[size=default]:h-9 data-[size=sm]:h-8 rounded-4xl border px-3 py-1 text-base transition-colors file:h-7 file:text-sm file:font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
