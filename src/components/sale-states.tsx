"use client";
import { Badge } from "@/components/ui";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";

export function SaleStates({ sale }: { sale: Schemas["SaleView"] | Schemas["SaleSummaryView"] }) {
  const codes = useCodes();
  if (!sale.paymentState) return null;
  return <span className="inline-flex flex-wrap gap-2" data-testid="sale-states">
    <Badge tone={sale.progress === "CANCELED" ? "bad" : sale.progress === "OPEN" ? "info" : "muted"}>
      {codes("saleProgress", sale.progress)}
    </Badge>
    <Badge tone={sale.paymentState.status === "PAID" ? "ok" : sale.paymentState.status === "DEPOSIT" ? "warn" : "muted"}>
      {codes("salePayment", sale.paymentState.status)}
    </Badge>
  </span>;
}
