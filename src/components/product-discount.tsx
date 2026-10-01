"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, ButtonLink, Checkbox, Field, Panel, SelectField } from "@/components/ui";
import type { Schemas } from "@/lib/backend";
import { formatAmount } from "@/lib/money";
import { messageFor, readJson } from "@/lib/read-json";

export type DiscountDraft = { type: "" | "PERCENT" | "FIXED"; value: string; enabled: boolean; includeWholesale: boolean };
export const emptyDiscount: DiscountDraft = { type: "", value: "", enabled: true, includeWholesale: false };

export function discountDraft(discount: Schemas["ProductView"]["discount"]): DiscountDraft {
  return discount?.type ? {
    type: discount.type, value: String(discount.value ?? ""), enabled: discount.enabled !== false,
    includeWholesale: discount.includeWholesale === true,
  } : emptyDiscount;
}

export function discountBody(discount: DiscountDraft) {
  return discount.type ? discount : { type: null };
}

export function DiscountFields({ value, onChange, currency }: {
  value: DiscountDraft; onChange: (value: DiscountDraft) => void; currency: string;
}) {
  const t = useTranslations("productDiscount");
  return <Panel title={t("title")}>
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate">{t("hint")}</p>
      {!value.type ? <Button type="button" variant="secondary" onClick={() => onChange({ ...emptyDiscount, type: "PERCENT" })}>{t("add")}</Button> : <>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={t("type")} value={value.type} onChange={(event) => onChange({ ...value, type: event.target.value as DiscountDraft["type"] })}>
            <option value="PERCENT">{t("percent")}</option><option value="FIXED">{t("fixed")}</option>
          </SelectField>
          <Field label={value.type === "PERCENT" ? t("percentage") : `${t("amount")} (${currency})`} type="number" inputMode="decimal" min="0.0001" max={value.type === "PERCENT" ? "100" : undefined} step="0.0001" required value={value.value} onChange={(event) => onChange({ ...value, value: event.target.value })} />
        </div>
        <Checkbox label={t("enabled")} checked={value.enabled} onChange={(event) => onChange({ ...value, enabled: event.target.checked })} />
        <Checkbox label={t("wholesale")} checked={value.includeWholesale} onChange={(event) => onChange({ ...value, includeWholesale: event.target.checked })} />
        <p className="text-xs text-slate">{t("capHint")}</p>
        <Button type="button" variant="ghost" onClick={() => onChange(emptyDiscount)}>{t("remove")}</Button>
      </>}
    </div>
  </Panel>;
}

export function ProductDiscountPanel({ product, currency, canEdit, onSaved }: {
  product: Schemas["ProductView"]; currency: string; canEdit: boolean; onSaved: (product: Schemas["ProductView"]) => void;
}) {
  const t = useTranslations("productDiscount");
  const errors = useTranslations("errors");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const discount = product.discount;
  async function save(remove: boolean) {
    setPending(true); setError(undefined);
    try {
      onSaved(await readJson<Schemas["ProductView"]>(`/api/catalog/products/${product.id}`, {
        method: "PATCH", body: JSON.stringify({ discount: remove ? { type: null } : { ...discount, enabled: !discount?.enabled } }),
      }));
    } catch (caught) { setError(messageFor(caught, (key) => errors(key), errors.has)); }
    finally { setPending(false); }
  }
  return <Panel title={t("title")}>
    <div className="flex flex-col gap-3">
      <p className="font-semibold text-ink">{discount?.type ? `${discount.type === "PERCENT" ? `${discount.value}%` : `${formatAmount(discount.value)} ${currency}`} · ${discount.enabled ? t("on") : t("off")}` : t("none")}</p>
      <p className="text-sm text-slate">{discount?.type ? (discount.includeWholesale ? t("bothPrices") : t("retailOnly")) : t("hint")}</p>
      {canEdit ? <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/products/${product.id}/edit`} variant="secondary">{discount?.type ? t("edit") : t("add")}</ButtonLink>
        {discount?.type ? <>
          <Button disabled={pending} onClick={() => void save(false)} variant="secondary">{discount.enabled ? t("turnOff") : t("turnOn")}</Button>
          <Button disabled={pending} onClick={() => void save(true)} variant="ghost">{t("remove")}</Button>
        </> : null}
      </div> : null}
      {error ? <Alert>{error}</Alert> : null}
    </div>
  </Panel>;
}
