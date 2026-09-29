"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Alert, Button, Checkbox, ConfirmButton, Field, Page, PageHeader, PageLoading, Panel, SelectField } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { formatAmount, marginPercent, profitPerUnit } from "@/lib/money";
import { messageFor, readJson } from "@/lib/read-json";

type Category = Schemas["CategoryView"];
type Location = Schemas["LocationView"];

export function ProductForm({ productId }: { productId?: string }) {
  const t = useTranslations("productForm");
  const errors = useTranslations("errors");
  const common = useTranslations("common");
  const codes = useCodes();
  const router = useRouter();
  const editing = Boolean(productId);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [currency, setCurrency] = useState("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState<Schemas["ProductWrite"]["unit"]>("PIECE");
  const [sizeLabel, setSizeLabel] = useState("");
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
  const [archiving, setArchiving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // editing: the form waits for the product instead of flashing empty fields
  const [loaded, setLoaded] = useState(!productId);

  useEffect(() => {
    void Promise.all([
      readJson<Category[]>("/api/catalog/categories"),
      readJson<Location[]>("/api/catalog/locations"),
      readJson<Schemas["OrganizationView"]>("/api/catalog/organization"),
    ]).then(([nextCategories, nextLocations, organization]) => {
      setCategories(nextCategories);
      setLocations(nextLocations.filter((row) => row.active !== false));
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

  async function save() {
    setError(undefined);
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    if (!editing && openingQty && !locationId) {
      setError(t("locationRequired"));
      return;
    }
    setPending(true);
    const body = {
      name,
      sku: sku || undefined,
      categoryId: categoryId || undefined,
      unit,
      sizeLabel: sizeLabel || undefined,
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
      const code = caught instanceof Error ? caught.message : "unknown";
      setError(errors.has(code) ? errors(code) : errors("unknown"));
      setPending(false);
    }
  }

  async function archive() {
    setError(undefined);
    setArchiving(true);
    try {
      await readJson(`/api/catalog/products/${productId}`, { method: "DELETE" });
      router.push("/products");
    } catch (caught) {
      setError(messageFor(caught, errors, (code) => errors.has(code)));
      setArchiving(false);
    }
  }

  if (!loaded) {
    return <PageLoading panels={3} />;
  }

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
          <Field className="sm:col-span-2" label={t("name")} onChange={(event) => setName(event.target.value)} required value={name} />
          <Field label={t("sku")} onChange={(event) => setSku(event.target.value)} value={sku} />
          <Field label={t("barcode")} onChange={(event) => setBarcode(event.target.value)} value={barcode} />
          <SelectField label={t("category")} onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
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
          <Field label={t("size")} onChange={(event) => setSizeLabel(event.target.value)} value={sizeLabel} />
        </div>
      </Panel>
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
                <Field inputMode="decimal" label={t("openingQty")} onChange={(event) => setOpeningQty(event.target.value)} value={openingQty} />
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
          <ConfirmButton
            busy={archiving}
            confirmLabel={t("archiveConfirm")}
            label={t("archive")}
            onConfirm={() => void archive()}
            question={t("archiveQuestion")}
          />
        </div>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}
      {/* Save stays within reach at the bottom of a long form, on a phone above all */}
      <div className="sticky bottom-16 z-10 -mx-4 flex flex-wrap justify-end gap-2 border-t border-line bg-white/95 px-4 pt-4 pb-4 backdrop-blur sm:-mx-8 sm:px-8 md:bottom-0 md:pb-[max(env(safe-area-inset-bottom),1rem)]">
        <Button onClick={() => router.push(editing ? `/products/${productId}` : "/products")} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button busy={pending} disabled={archiving} onClick={() => void save()} type="button">
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </Page>
  );
}
