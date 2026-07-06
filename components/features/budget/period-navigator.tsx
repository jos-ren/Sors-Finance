"use client";

import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface PeriodNavigatorProps {
  viewMode: "month" | "year";
  selectedMonth: { year: number; month: number };
  selectedYear: number;
  availableYears: number[];
  availableMonthsByYear?: Map<number, number[]>;
  onMonthSelect: (year: number, month: number) => void;
  onYearChange: (value: string) => void;
}

/** Lifted from the old budget page — month picker + prev/next, and a year
 *  selector for the Yearly Totals tab. */
export function PeriodNavigator({
  viewMode,
  selectedMonth,
  selectedYear,
  availableYears,
  availableMonthsByYear,
  onMonthSelect,
  onYearChange,
}: PeriodNavigatorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [displayYear, setDisplayYear] = useState(selectedMonth.year);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const yearOptions = [...new Set([...availableYears, currentYear])].sort((a, b) => b - a);
  const minYear = Math.min(...yearOptions);
  const maxYear = Math.max(...yearOptions);

  const goToPrevMonth = () => {
    if (selectedMonth.month === 0) onMonthSelect(selectedMonth.year - 1, 11);
    else onMonthSelect(selectedMonth.year, selectedMonth.month - 1);
  };
  const goToNextMonth = () => {
    if (selectedMonth.month === 11) onMonthSelect(selectedMonth.year + 1, 0);
    else onMonthSelect(selectedMonth.year, selectedMonth.month + 1);
  };
  const isAtCurrentMonth = selectedMonth.year === currentYear && selectedMonth.month === currentMonth;

  const isMonthEnabled = (year: number, month: number) => {
    if (year === currentYear && month === currentMonth) return true;
    if (!availableMonthsByYear) return true;
    return availableMonthsByYear.get(year)?.includes(month) ?? false;
  };

  const handlePickerOpenChange = (open: boolean) => {
    if (open) setDisplayYear(selectedMonth.year);
    setPickerOpen(open);
  };

  const handleMonthClick = (monthIndex: number) => {
    onMonthSelect(displayYear, monthIndex);
    setPickerOpen(false);
  };

  if (viewMode === "month") {
    const label = `${MONTH_NAMES_SHORT[selectedMonth.month]} ${selectedMonth.year}`;
    return (
      <div className="flex items-center">
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-r-none border-r-0" onClick={goToPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Popover open={pickerOpen} onOpenChange={handlePickerOpenChange}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-none h-9 px-3 gap-1.5 font-normal min-w-[130px] justify-center">
              <Calendar className="h-4 w-4" /> {label}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="end">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDisplayYear((y) => y - 1)} disabled={!yearOptions.includes(displayYear - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select value={displayYear.toString()} onValueChange={(v) => setDisplayYear(parseInt(v))}>
                  <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDisplayYear((y) => y + 1)} disabled={!yearOptions.includes(displayYear + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {MONTH_NAMES_SHORT.map((monthName, idx) => {
                  const enabled = isMonthEnabled(displayYear, idx);
                  const isSelected = selectedMonth.year === displayYear && selectedMonth.month === idx;
                  return (
                    <Button key={monthName} variant={isSelected ? "default" : "ghost"} size="sm" disabled={!enabled} onClick={() => handleMonthClick(idx)} className="h-8">
                      {monthName}
                    </Button>
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-l-none border-l-0" onClick={goToNextMonth} disabled={isAtCurrentMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <Button variant="outline" size="icon" className="h-9 w-9 rounded-r-none border-r-0" onClick={() => onYearChange(String(selectedYear - 1))} disabled={selectedYear <= minYear}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Select value={selectedYear.toString()} onValueChange={onYearChange}>
        <SelectTrigger className="w-28 h-9 rounded-none border-x-0 focus:ring-0 focus:ring-offset-0 [&>svg:last-child]:hidden">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 shrink-0" />
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((year) => (
            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="icon" className="h-9 w-9 rounded-l-none border-l-0" onClick={() => onYearChange(String(selectedYear + 1))} disabled={selectedYear >= maxYear}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
