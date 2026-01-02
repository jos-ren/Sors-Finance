import { Loader2 } from "lucide-react";

export function PageLoader() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
    </div>
  );
}
