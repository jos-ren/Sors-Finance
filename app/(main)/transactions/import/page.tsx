"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { TransactionImporter } from "@/components/features/transactions/transaction-importer";
import { invalidateTransactions, invalidateImports, invalidateImportDrafts } from "@/hooks";

export default function ImportTransactionsPage() {
  const router = useRouter();
  const sentinelRef = useSetPageHeader("Import Transactions");

  const handleComplete = () => {
    invalidateTransactions();
    invalidateImports();
    invalidateImportDrafts();
    router.push("/transactions");
  };

  const handleCancel = () => {
    router.push("/transactions");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] p-6 gap-5">
      <div className="flex-shrink-0 space-y-5">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/transactions">Transactions</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Import</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Transactions</h1>
          <p className="text-muted-foreground">
            Upload your bank statements and categorize transactions
          </p>
          <div ref={sentinelRef} className="h-0" />
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <TransactionImporter onComplete={handleComplete} onCancel={handleCancel} />
      </div>
    </div>
  );
}
