"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";

import { DeleteProduct } from "@/components/delete-product";
import { libraryName, SizeChartSelect } from "@/components/size-chart-select";
import { Alert, Button, Checkbox, Field, focusRing, Page, PageHeader, PageLoading, Panel, SelectField } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { formatAmount, marginPercent, profitPerUnit } from "@/lib/money";
import { ApiError, readJson } from "@/lib/read-json";
import {
  chartChoice,
  choiceChart,
  loadSizeCharts,
  resolveChart,
  sizeDisplay,
  sizeEquivalents as equivalentsOf,
  sizeLabels,
  type ChartChoice,
  type SizeChart,
  type SizeChartTemplate,
} from "@/lib/size-charts";

type Category = Schemas["CategoryView"];
type Location = Schemas["LocationView"];

export function ProductForm({ productId }: { productId?: string }) {
  const t = useTranslations("productForm");
  const errors = useTranslations("errors");
  const common = useTranslations("common");
  const names = useTranslations("sizeLibrary");
  const codes = useCodes();
  const router = useRouter();
  const editing = Boolean(productId);
  const sizePickerId = useId();
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [charts, setCharts] = useState<SizeChart[]>([]);
  const [library, setLibrary] = useState<SizeChartTemplate[]>([]);
  const [currency, setCurrency] = useState("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState<Schemas["ProductWrite"]["unit"]>("PIECE");
  const [sizeLabel, setSizeLabel] = useState("");
  // editing a size: the same size in other systems, "UK 8 · US M 9"
  const [sizeEquivalents, setSizeEquivalents] = useState("");
  // adding in sizes: the chart, and the sizes picked with their opening quantity ("" for none yet)
  const [chart, setChart] = useState<ChartChoice>("");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [openingCost, setOpeningCost] = useState("");
  const [openingQty, setOpeningQty] = useState("");
  const [locationId, setLocationId] = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [reorderPoint, setReorderPoint] = useState("0");
  const [sellInPos, setSellInPos] = useState(true);
  const [sellOnline, setSellOnline] = useState(false);
  const [taxable, setTaxable] = useState(true);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // editing: the form waits for the product instead of flashing empty fields
  const [loaded, setLoaded] = useState(!productId);

  useEffect(() => {
    void Promise.all([
      readJson<Category[]>("/api/catalog/categories"),
      readJson<Location[]>("/api/catalog/locations"),
      readJson<Schemas["OrganizationView"]>("/api/catalog/organization"),
      // sizes are chosen when adding; an existing size is edited as the product it is
      productId ? Promise.resolve<[SizeChart[], SizeChartTemplate[]]>([[], []]) : loadSizeCharts(),
    ]).then(([nextCategories, nextLocations, organization, [nextCharts, nextLibrary]]) => {
      setCategories(nextCategories);
      setLocations(nextLocations.filter((row) => row.active !== false));
      setCharts(nextCharts);
      setLibrary(nextLibrary);
      setCurrency(organization.currencyCode ?? "");
      // a new product in an online shop is sold online unless unticked
      if (!productId && organization.businessType === "ONLINE") {
        setSellOnline(true);
      }
      const first = nextLocations.find((row) => row.active !== false);
      if (first?.id) {
        setLocationId(first.id);
      }
    }).catch(() => setLoadFailed(true));
    if (!productId) {
      return;
    }
    void readJson<Schemas["ProductView"]>(`/api/catalog/products/${productId}`).then((product) => {
      setName(product.name ?? "");
      setSku(product.sku ?? "");
      setBarcode(product.barcodes?.[0] ?? "");
      setCategoryId(product.categoryId ?? "");
      setUnit(product.unit ?? "PIECE");
      setSizeLabel(product.sizeLabel ?? "");
      setSizeEquivalents(product.sizeEquivalents ?? "");
      setRetailPrice(product.retailPrice === undefined ? "" : String(product.retailPrice));
      setWholesalePrice(product.wholesalePrice === undefined ? "" : String(product.wholesalePrice));
      setTrackInventory(product.trackInventory !== false);
      setReorderPoint(String(product.reorderPoint ?? 0));
      setSellInPos(product.sellInPos !== false);
      setSellOnline(product.sellOnline === true);
      setTaxable(product.taxable !== false);
      setActive(product.active !== false);
      setLoaded(true);
    });
  }, [productId]);

  const margin = marginPercent(retailPrice, openingCost);
  const profit = profitPerUnit(retailPrice, openingCost);
  const sizeChart = choiceChart(chart, charts, library);
  const labels = sizeLabels(sizeChart);
  const picked = labels.filter((label) => label in sizes);
  const [labelSystem, ...otherSystems] = sizeChart?.systems ?? [];

  function pickChart(choice: ChartChoice) {
    setChart(choice);
    setSizes({});
  }

  /** A category with a size chart (or under one that has it) opens its sizes. */
  function pickCategory(id: string) {
    setCategoryId(id);
    const category = categories.find((row) => row.id === id);
    const parent = categories.find((row) => row.id === category?.parentId);
    const sizeChartId = category?.sizeChartId ?? parent?.sizeChartId;
    if (!editing && sizeChartId && charts.some((row) => row.id === sizeChartId)) {
      pickChart(chartChoice({ id: sizeChartId }));
    }
  }

  function toggleSize(label: string) {
    setSizes((current) => {
      const next = { ...current };
      if (label in next) {
        delete next[label];
      } else {
        next[label] = "";
      }
      return next;
    });
  }

  function fail(caught: unknown) {
    const code = caught instanceof Error ? caught.message : "unknown";
    setError(errors.has(code) ? errors(code) : errors("unknown"));
    setPending(false);
  }

  async function saveSizes() {
    if (picked.length === 0) {
      setError(t("sizesRequired"));
      return;
    }
    const stocked = picked.some((label) => Number(sizes[label] || 0) > 0);
    if (stocked && !locationId) {
      setError(t("locationRequired"));
      return;
    }
    if (stocked && !openingCost) {
      setError(t("costRequired"));
      return;
    }
    setPending(true);
    try {
      const saved = await resolveChart(chart, charts, (key) => libraryName(names, { key }));
      if (!saved?.id) {
        throw new ApiError("size_chart_not_found");
      }
      const created = await readJson<Schemas["ProductView"][]>("/api/catalog/products/sizes", {
        method: "POST",
        body: JSON.stringify({
          name,
          categoryId: categoryId || undefined,
          unit,
          retailPrice,
          wholesalePrice: wholesalePrice || undefined,
          trackInventory,
          reorderPoint: Number(reorderPoint || 0),
          sellInPos,
          sellOnline,
          taxable,
          active,
          sizeChartId: saved.id,
          locationId: stocked ? locationId : undefined,
          unitCost: stocked ? openingCost : undefined,
          sizes: picked.map((label) => ({ label, quantity: sizes[label] || undefined })),
        }),
      });
      router.push(`/products?added=${encodeURIComponent(name.trim())}&sizes=${created.length}`);
    } catch (caught) {
      fail(caught);
    }
  }

  async function save() {
    setError(undefined);
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    if (!editing && !retailPrice) {
      setError(t("priceRequired"));
      return;
    }
    if (sizeChart && !editing) {
      await saveSizes();
      return;
    }
    if (!editing && openingQty && !locationId) {
      setError(t("locationRequired"));
      return;
    }
    if (!editing && Number(openingQty || 0) > 0 && !openingCost) {
      setError(t("costRequired"));
      return;
    }
    setPending(true);
    const body = {
      name,
      sku: sku || undefined,
      categoryId: categoryId || undefined,
      unit,
      sizeLabel: sizeLabel || undefined,
      // an emptied box removes them; a product without sizes never sends the field
      sizeEquivalents: editing && (sizeLabel || sizeEquivalents) ? sizeEquivalents : undefined,
      retailPrice: retailPrice || undefined,
      wholesalePrice: wholesalePrice || undefined,
      trackInventory,
      reorderPoint: Number(reorderPoint || 0),
      sellInPos,
      sellOnline,
      taxable,
      active,
      barcodes: barcode ? [barcode] : undefined,
      openingStock:
        !editing && openingQty
          ? [{ locationId, quantity: openingQty, unitCost: openingCost || undefined }]
          : undefined,
    } as Schemas["ProductWrite"];
    try {
      const saved = await readJson<Schemas["ProductView"]>(
        editing ? `/api/catalog/products/${productId}` : "/api/catalog/products",
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      router.push(`/products/${saved.id}`);
    } catch (caught) {
      fail(caught);
    }
  }

  if (!loaded) {
    return <PageLoading panels={3} />;
  }

  const inSizes = Boolean(sizeChart) && !editing;

  return (
    <Page width="narrow">
      <PageHeader title={editing ? t("editTitle") : t("addTitle")} subtitle={t("subtitle")} />
      {loadFailed ? (
        <div className="flex flex-col gap-2">
          <Alert>{t("loadFailed")}</Alert>
          <Button className="self-start" onClick={() => window.location.reload()} type="button" variant="secondary">
            {common("retry")}
          </Button>
        </div>
      ) : null}
      <Panel title={t("basics")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            className="sm:col-span-2"
            hint={inSizes ? t("modelHint") : undefined}
            label={t("name")}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
          {inSizes ? null : (
            <>
              <Field label={t("sku")} onChange={(event) => setSku(event.target.value)} value={sku} />
              <Field label={t("barcode")} onChange={(event) => setBarcode(event.target.value)} value={barcode} />
            </>
          )}
          <SelectField label={t("category")} onChange={(event) => pickCategory(event.target.value)} value={categoryId}>
            <option value="">{t("noCategory")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("unit")} onChange={(event) => setUnit(event.target.value as typeof unit)} value={unit}>
            {["PIECE", "BAG", "BOX", "KG", "LITRE", "PACK"].map((value) => (
              <option key={value} value={value}>
                {codes("unit", value)}
              </option>
            ))}
          </SelectField>
          {inSizes ? null : <Field label={t("size")} onChange={(event) => setSizeLabel(event.target.value)} value={sizeLabel} />}
          {editing && (sizeLabel || sizeEquivalents) ? (
            <Field
              className="sm:col-span-2"
              hint={t("sameSizeHint")}
              label={t("sameSize")}
              maxLength={255}
              onChange={(event) => setSizeEquivalents(event.target.value)}
              value={sizeEquivalents}
            />
          ) : null}
        </div>
      </Panel>
      {editing ? null : (
        <Panel title={t("sizes")}>
          <div className="flex flex-col gap-4">
            <SizeChartSelect
              charts={charts}
              hint={
                sizeChart
                  ? otherSystems.length > 0
                    ? t("labelledBy", { system: labelSystem || t("unnamedSystem"), others: otherSystems.map((system) => system || t("unnamedSystem")).join(" · ") })
                    : t("labelledByAlone", { system: labelSystem || t("unnamedSystem") })
                  : t("sizesHint")
              }
              label={t("sizeChart")}
              library={library}
              noneLabel={t("oneProduct")}
              onChange={pickChart}
              value={chart}
            />
            {sizeChart ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink" id={sizePickerId}>
                    {t("pickSizes")}
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => setSizes(Object.fromEntries(labels.map((label) => [label, sizes[label] ?? ""])))} type="button" variant="ghost">
                      {t("allSizes")}
                    </Button>
                    <Button onClick={() => setSizes({})} type="button" variant="ghost">
                      {t("noSizes")}
                    </Button>
                  </div>
                </div>
                <div aria-labelledby={sizePickerId} className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="group">
                  {labels.map((label) => {
                    const on = label in sizes;
                    return (
                      <button
                        aria-pressed={on}
                        className={`min-h-12 rounded-button border px-2 text-sm font-semibold tabular-nums transition-colors motion-reduce:transition-none ${focusRing} ${
                          on ? "border-indigo bg-indigo text-white" : "border-line bg-white text-ink hover:border-slate-300 hover:bg-slate-50"
                        }`}
                        key={label}
                        onClick={() => toggleSize(label)}
                        type="button"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {picked.length > 0 ? (
                  <div className="flex flex-col gap-2 border-t border-line pt-4">
                    <h3 className="text-sm font-semibold text-ink">{t("sizeStock")}</h3>
                    <p className="text-xs text-slate">{t("sizeStockHint")}</p>
                    <ul className="flex flex-col divide-y divide-line">
                      {picked.map((label) => {
                        const others = equivalentsOf(sizeChart, label);
                        return (
                          <li className="flex items-center gap-4 py-2" key={label}>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-ink tabular-nums">{sizeDisplay(sizeChart, label)}</span>
                              {others ? <span className="block text-xs text-slate tabular-nums">{others}</span> : null}
                            </span>
                            <Field
                              className="w-24 shrink-0"
                              hideLabel
                              inputMode="decimal"
                              label={t("quantityFor", { size: sizeDisplay(sizeChart, label) })}
                              onChange={(event) => setSizes((current) => ({ ...current, [label]: event.target.value }))}
                              placeholder="0"
                              value={sizes[label]}
                            />
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-xs text-slate">{t("sizesSkuHint")}</p>
                    <p className="text-sm text-slate">
                      {t("sizesSummary", {
                        count: picked.length,
                        example: `${name.trim() ? `${name.trim()} · ` : ""}${sizeDisplay(sizeChart, picked[0])}`,
                      })}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </Panel>
      )}
      <Panel title={t("prices")}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            disabled={editing}
            hint={editing ? t("costLocked") : t("openingCost")}
            inputMode="decimal"
            label={currency ? `${t("cost")} (${currency})` : t("cost")}
            onChange={(event) => setOpeningCost(event.target.value)}
            value={openingCost}
          />
          <Field inputMode="decimal" label={`${t("retail")} (${currency})`} onChange={(event) => setRetailPrice(event.target.value)} value={retailPrice} />
          <Field inputMode="decimal" label={`${t("wholesale")} (${currency})`} onChange={(event) => setWholesalePrice(event.target.value)} value={wholesalePrice} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 rounded-button bg-surface p-4 text-sm">
          <div>
            <dt className="text-slate">{t("margin")}</dt>
            <dd className="font-semibold text-ink tabular-nums">{margin ? `${margin}%` : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate">{t("profit")}</dt>
            <dd className="font-semibold text-ink tabular-nums">{profit ? `${formatAmount(profit)} ${currency}` : "—"}</dd>
          </div>
        </dl>
      </Panel>
      <Panel title={t("inventory")}>
        <div className="flex flex-col gap-4">
          <Checkbox checked={trackInventory} label={t("track")} onChange={(event) => setTrackInventory(event.target.checked)} />
          <div className="grid gap-4 sm:grid-cols-3">
            {editing ? null : (
              <>
                <SelectField label={t("location")} onChange={(event) => setLocationId(event.target.value)} value={locationId}>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </SelectField>
                {inSizes ? null : (
                  <Field inputMode="decimal" label={t("openingQty")} onChange={(event) => setOpeningQty(event.target.value)} value={openingQty} />
                )}
              </>
            )}
            <Field inputMode="decimal" label={t("reorder")} onChange={(event) => setReorderPoint(event.target.value)} value={reorderPoint} />
          </div>
          <div className="border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">{t("options")}</h3>
            <div className="grid sm:grid-cols-2 sm:gap-x-8">
              <Checkbox checked={sellInPos} label={t("sellPos")} onChange={(event) => setSellInPos(event.target.checked)} />
              <Checkbox checked={sellOnline} label={t("sellOnline")} onChange={(event) => setSellOnline(event.target.checked)} />
              <Checkbox checked={taxable} label={t("taxable")} onChange={(event) => setTaxable(event.target.checked)} />
              <Checkbox checked={active} label={t("active")} onChange={(event) => setActive(event.target.checked)} />
            </div>
          </div>
        </div>
      </Panel>
      {editing ? (
        <div>
          <DeleteProduct onDeleted={() => router.push(`/products?deleted=${encodeURIComponent(name)}`)} product={{ id: productId, name }} />
        </div>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}
      {/* Save stays within reach at the bottom of a long form, on a phone above all */}
      <div className="sticky bottom-16 z-10 -mx-4 flex flex-wrap justify-end gap-2 border-t border-line bg-white/95 px-4 pt-4 pb-4 backdrop-blur sm:-mx-8 sm:px-8 md:bottom-0 md:pb-[max(env(safe-area-inset-bottom),1rem)]">
        <Button onClick={() => router.push(editing ? `/products/${productId}` : "/products")} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button busy={pending} onClick={() => void save()} type="button">
          {pending ? t("saving") : inSizes && picked.length > 0 ? t("saveSizes", { count: picked.length }) : t("save")}
        </Button>
      </div>
    </Page>
  );
}
