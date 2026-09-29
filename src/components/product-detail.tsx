"use client";

import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { useTranslations } from "next-intl";

import { DeleteProduct } from "@/components/delete-product";
import { Badge, ButtonLink, Page, PageHeader, PageLoading, Panel } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import type { Schemas } from "@/lib/backend";
import { addQuantities, formatAmount, formatQuantity, marginPercent, weightedAverageCost } from "@/lib/money";
import { readJson } from "@/lib/read-json";

export function ProductDetail({ productId }: { productId: string }) {
  const t = useTranslations("productDetail");
  const router = useRouter();
  const [product, setProduct] = useState<Schemas["ProductView"]>();
  const [category, setCategory] = useState("—");
  const [locations, setLocations] = useState<Schemas["LocationView"][]>([]);
  const [balances, setBalances] = useState<Schemas["BalanceView"][]>([]);
  const [currency, setCurrency] = useState("");

  useEffect(() => {
    void Promise.all([
      readJson<Schemas["ProductView"]>(`/api/catalog/products/${productId}`),
      readJson<Schemas["CategoryView"][]>("/api/catalog/categories"),
      readJson<Schemas["LocationView"][]>("/api/catalog/locations"),
      readJson<Schemas["BalanceView"][]>("/api/catalog/balances"),
      readJson<Schemas["OrganizationView"]>("/api/catalog/organization"),
    ]).then(([nextProduct, categories, nextLocations, nextBalances, organization]) => {
      setProduct(nextProduct);
      setCategory(categories.find((row) => row.id === nextProduct.categoryId)?.name ?? "—");
      setLocations(nextLocations);
      setBalances(nextBalances.filter((row) => row.productId === productId));
      setCurrency(organization.currencyCode ?? "");
    });
  }, [productId]);

  if (!product) {
    return <PageLoading panels={2} />;
  }
  const cost = weightedAverageCost(balances);
  const quantity = addQuantities(balances.map((row) => row.quantity));
  const margin = cost && product.retailPrice !== undefined ? marginPercent(String(product.retailPrice), cost) : null;
  const low = product.trackInventory && new Decimal(quantity || 0).lte(product.reorderPoint ?? 0);

  return (
    <Page>
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/products/${product.id}/edit`} variant="secondary">
              {t("edit")}
            </ButtonLink>
            <DeleteProduct
              onDeleted={() => router.push(`/products?deleted=${encodeURIComponent(product.name ?? "")}`)}
              product={product}
            />
          </div>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {product.active === false ? <Badge tone="muted">{t("inactive")}</Badge> : null}
            <span>{[product.sku, product.barcodes?.[0], category].filter(Boolean).join(" · ")}</span>
            {product.sizeEquivalents ? <span className="basis-full">{t("sameSize", { sizes: product.sizeEquivalents })}</span> : null}
          </span>
        }
        title={product.name ?? ""}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat currency={currency} label={t("retail")} note={margin ? t("margin", { value: margin }) : undefined} value={formatAmount(product.retailPrice)} />
        <Stat currency={currency} label={t("wholesale")} value={formatAmount(product.wholesalePrice)} />
        <Stat currency={currency} label={t("cost")} value={cost ? formatAmount(cost) : "—"} />
        <Stat
          label={t("stock")}
          note={product.trackInventory ? `${t("reorder")} ${product.reorderPoint ?? 0}` : undefined}
          tone={low ? "warn" : undefined}
          value={product.trackInventory ? formatQuantity(quantity) : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title={t("locations")}>
          {balances.length === 0 ? (
            <p className="text-sm text-slate">{t("noStock")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {balances.map((row) => (
                <li className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0" key={row.locationId}>
                  <span className="font-medium text-ink">{locations.find((location) => location.id === row.locationId)?.name ?? row.locationId}</span>
                  <span className="font-semibold tabular-nums">{formatQuantity(row.quantity)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("flags")}>
          <div className="flex flex-wrap gap-2">
            <Badge tone={product.sellInPos ? "ok" : "muted"}>{product.sellInPos ? t("inPos") : t("notInPos")}</Badge>
            <Badge tone={product.sellOnline ? "ok" : "muted"}>{product.sellOnline ? t("online") : t("notOnline")}</Badge>
            <Badge tone={product.active === false ? "muted" : "info"}>{product.active === false ? t("inactive") : t("active")}</Badge>
          </div>
        </Panel>
      </div>
    </Page>
  );
}

function Stat({
  label,
  value,
  currency,
  note,
  tone,
}: {
  label: string;
  value: string;
  currency?: string;
  note?: string;
  tone?: "warn";
}) {
  return (
    <div className={`flex min-w-0 flex-col rounded-panel border bg-white p-4 shadow-xs sm:p-6 ${tone === "warn" ? "border-amber-300" : "border-line"}`}>
      <p className="text-sm font-medium text-slate">{label}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-1">
        <span className="text-xl font-bold text-ink tabular-nums sm:text-2xl">{value}</span>
        {currency && value !== "—" ? <span className="text-xs font-medium text-slate">{currency}</span> : null}
      </p>
      {note ? <p className={`mt-2 text-xs ${tone === "warn" ? "font-semibold text-amber-800" : "text-slate"}`}>{note}</p> : null}
    </div>
  );
}
