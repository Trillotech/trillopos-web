"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { DeleteProduct } from "@/components/delete-product";
import { BoxIcon, PlusIcon } from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  focusRing,
  insetFocusRing,
  LoadingRows,
  Page,
  PageHeader,
  SearchField,
  SelectField,
} from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Schemas } from "@/lib/backend";
import { addQuantities, formatAmount, weightedAverageCost } from "@/lib/money";
import { messageFor, readJson } from "@/lib/read-json";

type Product = Schemas["ProductView"];
type Category = Schemas["CategoryView"];
type Balance = Schemas["BalanceView"];

export function ProductList() {
  const t = useTranslations("products");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [currency, setCurrency] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stock, setStock] = useState("active");
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const deletion = useTranslations("productDelete");
  // ?deleted=<name>: the product was deleted on its own page, which then came here
  const deletedName = useSearchParams().get("deleted");
  const [notice, setNotice] = useState(deletedName ? deletion("deleted", { name: deletedName }) : undefined);

  function removed(product: Product) {
    setProducts((current) => current.filter((row) => row.id !== product.id));
    setNotice(deletion("deleted", { name: product.name ?? "" }));
  }

  useEffect(() => {
    void Promise.all([
      readJson<Product[]>("/api/catalog/products"),
      readJson<Category[]>("/api/catalog/categories"),
      readJson<Balance[]>("/api/catalog/balances"),
      readJson<Schemas["OrganizationView"]>("/api/catalog/organization"),
    ])
      .then(([nextProducts, nextCategories, nextBalances, organization]) => {
        setProducts(nextProducts);
        setCategories(nextCategories);
        setBalances(nextBalances);
        setCurrency(organization.currencyCode ?? "");
      })
      .catch((caught) => setError(messageFor(caught, errors, (code) => errors.has(code))))
      .finally(() => setLoaded(true));
  }, [errors]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const stockRows = balances.filter((row) => row.productId === product.id);
      const quantity = addQuantities(stockRows.map((row) => row.quantity));
      if (categoryId && product.categoryId !== categoryId) {
        return false;
      }
      if (stock === "active" && product.active === false) {
        return false;
      }
      if (stock === "inactive" && product.active !== false) {
        return false;
      }
      if (stock === "low" && !(product.trackInventory && Number(quantity) > 0 && Number(quantity) <= (product.reorderPoint ?? 0))) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const category = categories.find((row) => row.id === product.categoryId)?.name ?? "";
      return [product.name, product.sku, product.barcodes?.join(" "), category].join(" ").toLowerCase().includes(needle);
    });
  }, [products, balances, categories, query, categoryId, stock]);

  const addProduct = (
    <ButtonLink href="/products/new">
      <PlusIcon className="size-5" />
      {t("add")}
    </ButtonLink>
  );
  const money = (label: string) => (currency ? `${label} (${currency})` : label);

  return (
    <Page>
      <PageHeader actions={addProduct} subtitle={t("subtitle")} title={t("title")} />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <SearchField label={t("search")} onChange={(event) => setQuery(event.target.value)} value={query} />
        <SelectField hideLabel label={t("category")} onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
          <option value="">{t("allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <SelectField hideLabel label={t("stock")} onChange={(event) => setStock(event.target.value)} value={stock}>
          <option value="active">{t("stockActive")}</option>
          <option value="inactive">{t("stockInactive")}</option>
          <option value="low">{t("stockLow")}</option>
          <option value="all">{t("stockAll")}</option>
        </SelectField>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {!loaded ? (
        <LoadingRows rows={6} />
      ) : error ? null : products.length === 0 ? (
        <EmptyState action={addProduct} hint={t("emptyHint")} icon={<BoxIcon className="size-6" />} title={t("empty")} />
      ) : rows.length === 0 ? (
        <EmptyState
          action={
            <Button
              onClick={() => {
                setQuery("");
                setCategoryId("");
                setStock("active");
              }}
              type="button"
              variant="secondary"
            >
              {common("clearFilters")}
            </Button>
          }
          hint={t("noMatchHint")}
          title={t("noMatch")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate">{t("count", { count: rows.length })}</p>

          {/* phones and tablets: one row per product, the whole row opens it */}
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-panel border border-line bg-white shadow-xs lg:hidden">
            {rows.map((product) => {
              const stockRows = balances.filter((row) => row.productId === product.id);
              const quantity = addQuantities(stockRows.map((row) => row.quantity));
              const category = categories.find((row) => row.id === product.categoryId)?.name;
              return (
                <li className="flex items-center" key={product.id}>
                  <Link
                    className={`flex min-w-0 flex-1 items-center gap-4 py-4 pr-2 pl-4 transition-colors hover:bg-slate-50 motion-reduce:transition-none ${insetFocusRing}`}
                    href={`/products/${product.id}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{product.name}</span>
                      <span className="block truncate text-xs text-slate">
                        {[product.sku, category, product.trackInventory ? `${t("stock")} ${quantity}` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-sm font-semibold text-ink tabular-nums">
                        {formatAmount(product.retailPrice)} <span className="text-xs font-medium text-slate">{currency}</span>
                      </span>
                      <StockBadge active={product.active} quantity={quantity} reorderPoint={product.reorderPoint} tracked={product.trackInventory} />
                    </span>
                  </Link>
                  <span className="pr-2">
                    <DeleteProduct compact onDeleted={() => removed(product)} product={product} />
                  </span>
                </li>
              );
            })}
          </ul>

          {/* desktop: the full table */}
          <div className="hidden overflow-x-auto rounded-panel border border-line bg-white shadow-xs lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs font-semibold text-slate">
                <tr>
                  <th className="px-4 py-4" scope="col">{t("product")}</th>
                  <th className="px-4 py-4" scope="col">{t("sku")}</th>
                  <th className="hidden px-4 py-4 2xl:table-cell" scope="col">{t("barcode")}</th>
                  <th className="px-4 py-4" scope="col">{t("category")}</th>
                  <th className="px-4 py-4 text-right" scope="col">{money(t("cost"))}</th>
                  <th className="px-4 py-4 text-right" scope="col">{money(t("retail"))}</th>
                  <th className="hidden px-4 py-4 text-right xl:table-cell" scope="col">{money(t("wholesale"))}</th>
                  <th className="px-4 py-4 text-right" scope="col">{t("stock")}</th>
                  <th className="px-4 py-4" scope="col">{t("status")}</th>
                  <th className="px-2 py-4" scope="col">
                    <span className="sr-only">{deletion("button")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((product) => {
                  const stockRows = balances.filter((row) => row.productId === product.id);
                  const quantity = addQuantities(stockRows.map((row) => row.quantity));
                  const cost = weightedAverageCost(stockRows);
                  const category = categories.find((row) => row.id === product.categoryId)?.name ?? "—";
                  return (
                    <tr className="transition-colors hover:bg-slate-50 motion-reduce:transition-none" key={product.id}>
                      <td className="px-4 py-4">
                        <Link
                          className={`rounded-sm font-semibold text-ink hover:text-indigo hover:underline ${focusRing}`}
                          href={`/products/${product.id}`}
                        >
                          {product.name}
                        </Link>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs whitespace-nowrap text-slate">{product.sku}</td>
                      <td className="hidden px-4 py-4 font-mono text-xs whitespace-nowrap text-slate 2xl:table-cell">{product.barcodes?.[0] ?? "—"}</td>
                      <td className="px-4 py-4 text-slate">{category}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{cost ? formatAmount(cost) : "—"}</td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums">{formatAmount(product.retailPrice)}</td>
                      <td className="hidden px-4 py-4 text-right tabular-nums xl:table-cell">{formatAmount(product.wholesalePrice)}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{product.trackInventory ? quantity : "—"}</td>
                      <td className="px-4 py-4">
                        <StockBadge active={product.active} quantity={quantity} reorderPoint={product.reorderPoint} tracked={product.trackInventory} />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end">
                          <DeleteProduct compact onDeleted={() => removed(product)} product={product} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Page>
  );
}

function StockBadge({
  active,
  tracked,
  quantity,
  reorderPoint,
}: {
  active?: boolean;
  tracked?: boolean;
  quantity: string;
  reorderPoint?: number;
}) {
  const t = useTranslations("products");
  if (active === false) {
    return <Badge tone="muted">{t("inactive")}</Badge>;
  }
  if (!tracked) {
    return <Badge tone="muted">{t("notTracked")}</Badge>;
  }
  const qty = Number(quantity);
  if (qty <= 0) {
    return <Badge tone="bad">{t("outOfStock")}</Badge>;
  }
  if (reorderPoint !== undefined && qty <= reorderPoint) {
    return <Badge tone="warn">{t("lowStock")}</Badge>;
  }
  return <Badge tone="ok">{t("inStock")}</Badge>;
}
