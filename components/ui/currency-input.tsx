"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "size"> {
  value: string;
  onChange: (value: string) => void;
  allowNegative?: boolean;
  size?: "sm" | "default";
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, allowNegative = false, onBlur, size, ...props }, ref) => {
    // Only allow numbers, decimal point, and optionally negative sign
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Allow empty string
      if (inputValue === "") {
        onChange("");
        return;
      }

      // Build regex based on whether negative is allowed
      const regex = allowNegative
        ? /^-?\d*\.?\d*$/
        : /^\d*\.?\d*$/;

      if (regex.test(inputValue)) {
        onChange(inputValue);
      }
    };

    // Format to 2 decimal places on blur
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const val = parseFloat(value);
      if (!isNaN(val)) {
        onChange(val.toFixed(2));
      }
      onBlur?.(e);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        size={size}
        className={cn(className)}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
