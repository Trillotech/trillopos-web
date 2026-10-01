"use client";

import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { useTranslations } from "next-intl";

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ConfirmButton,
  Field,
  Page,
  PageHeader,
  PageLoading,
  Panel,
  SelectField,
} from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { SaleStates } from "@/components/sale-states";
import { SaleWorkflow } from "@/components/sale-workflow";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { formatAmount, formatQuantity } from "@/lib/money";
import { messageFor, readJson, readResponse } from "@/lib/read-json";

type SaleLine = Schemas["SaleLineView"];

const refundMethods = ["CASH", "KBZ_PAY", "WAVE_PAY", "AYA_PAY", "CB_PAY", "BANK_TRANSFER", "OTHER", "CREDIT"] as const;
const payMethods = ["CASH", "KBZ_PAY", "WAVE_PAY", "AYA_PAY", "CB_PAY", "BANK_TRANSFER", "OTHER", "CREDIT"] as const;

/** A figure is worth a row on the receipt only when it is not zero. */
function nonZero(value?: number | string) {
  return value != null && !new Decimal(value).isZero();
}

export function SaleReceipt({ saleId }: { saleId: string }) {
  const t = useTranslations("receipt");
  const errors = useTranslations("errors");
  const codes = useCodes();
  const [sale, setSale] = useState<Schemas["SaleView"]>();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const [method, setMethod] = useState<(typeof refundMethods)[number]>("CASH");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [payMethod, setPayMethod] = useState<(typeof payMethods)[number]>("CASH");
  const [payReference, setPayReference] = useState("");
  const [completionKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState<"charge" | "void" | "return">();
  const router = useRouter();

  useEffect(() => {
    void readJson<Schemas["SaleView"]>(`/api/sales/${saleId}`).then(setSale)
      .catch(caught=>setError(messageFor(caught, errors, code=>errors.has(code))));
  }, [saleId, errors]);

  if (!sale) {
    return error ? <Page><Alert>{error}</Alert></Page> : <PageLoading panels={2} />;
  }

  const lines = (sale.lines ?? []) as SaleLine[];
  const creditSale = (sale.payments ?? []).some((payment) => payment.method === "CREDIT")
    || (sale.dueAmount != null && new Decimal(sale.dueAmount).gt(0));
  const returnable = sale.status === "COMPLETED" || sale.status === "PARTIALLY_REFUNDED";
  const parked = sale.status === "HELD" || sale.status === "DRAFT";
  const when = sale.soldAt ? new Date(sale.soldAt).toLocaleString() : undefined;
  const discounts = new Decimal(sale.lineDiscountTotal ?? 0).plus(sale.cartDiscountAmount ?? 0);
  const tone = sale.status === "COMPLETED" ? "ok" : parked ? "warn" : sale.status === "VOID" ? "bad" : "muted";

  /** Charge a held cart for its whole total with one payment. */
  async function completeCart(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy("charge");
    try {
      const done = await readJson<Schemas["SaleView"]>(`/api/sales/${saleId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: completionKey,
          payments: [{
            method: payMethod,
            amount: String(sale?.total ?? "0"),
            tenderedAmount: payMethod === "CASH" ? String(sale?.total ?? "0") : undefined,
            referenceNo: payReference || undefined,
          }],
        }),
      });
      setSale(done);
    } catch (caught) {
      setError(messageFor(caught, errors, (code) => errors.has(code)));
    } finally {
      setBusy(undefined);
    }
  }

  async function voidCart() {
    setError(undefined);
    setBusy("void");
    try {
      await readJson(`/api/sales/${saleId}/void`, { method: "POST" });
      router.push("/sales/held");
    } catch (caught) {
      setError(messageFor(caught, errors, (code) => errors.has(code)));
      setBusy(undefined);
    }
  }
  const methods = refundMethods.filter((value) => value !== "CREDIT" || creditSale);

  async function submitReturn(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setNotice(undefined);
    const chosen = lines
      .filter((line) => line.id && quantities[line.id])
      .map((line) => ({
        saleLineId: line.id,
        quantity: quantities[line.id!],
        restock: restock[line.id!] !== false,
      }));
    if (chosen.length === 0 || !sale?.locationId) {
      return;
    }
    setBusy("return");
    let cashierShiftId: string | undefined;
    if (method === "CASH") {
      try {
        const shift = await readJson<Schemas["ShiftView"]>(`/api/sales/shifts?locationId=${sale.locationId}`);
        cashierShiftId = shift.status === "OPEN" ? shift.id : undefined;
      } catch {
        cashierShiftId = undefined;
      }
    }
    try {
      const result = await readResponse<Schemas["ReturnView"]>("/api/returns", {
        method: "POST",
        body: JSON.stringify({
          saleId: sale.id,
          locationId: sale.locationId,
          cashierShiftId,
          refundMethod: method,
          referenceNo: reference || undefined,
          reason: reason || undefined,
          lines: chosen,
          idempotencyKey: key,
        }),
      });
      setNotice(result.replayed ? t("replayed") : [t("returned"), result.data.returnNumber].filter(Boolean).join(" · "));
      setKey(crypto.randomUUID());
      setSale(await readJson<Schemas["SaleView"]>(`/api/sales/${saleId}`));
    } catch (caught) {
      setError(messageFor(caught, errors, (code) => errors.has(code)));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Page width="narrow">
      <PageHeader
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {sale.status !== "COMPLETED" ? <Badge tone={tone}>{sale.status === "REFUNDED" ? t("allItemsReturned") : codes("saleStatus", sale.status)}</Badge> : null}
            <SaleStates sale={sale} />
            <span>{codes("channel", sale.channel)}</span>
            {when ? <span>· {when}</span> : null}
          </span>
        }
        title={sale.receiptNumber ?? t("parked")}
      />
      {sale.paymentState ? <SaleWorkflow sale={sale} onSaved={setSale} /> : null}
      {/* above the receipt: a return of everything closes the Return form it came from */}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <Panel>
        <div className="flex flex-col gap-6">
          <p className="text-sm">
            {sale.customerId ? (
              <>
                <span className="text-slate">{t("customer")}</span>{" "}
                <span className="font-semibold text-ink">{sale.customerName ?? sale.customerId}</span>
              </>
            ) : (
              <span className="text-slate">{t("walkIn")}</span>
            )}
          </p>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink">{t("items")}</h2>
            <ul className="flex flex-col divide-y divide-line text-sm">
              {lines.map((line) => (
                <li className="flex items-start justify-between gap-4 py-2" key={line.id ?? line.position}>
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{line.productName ?? line.productId}</span>
                    <span className="block text-xs text-slate tabular-nums">
                      {formatQuantity(line.quantity)} × {formatAmount(line.unitPrice)}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatAmount(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </div>

          <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
            <Row label={t("subtotal")} value={formatAmount(sale.subtotal)} />
            {discounts.isZero() ? null : <Row label={t("discounts")} value={`−${formatAmount(discounts.toString())}`} />}
            {nonZero(sale.taxAmount) ? (
              <Row label={sale.taxInclusive ? t("taxIncluded") : t("tax")} value={formatAmount(sale.taxAmount)} />
            ) : null}
            {nonZero(sale.roundingAdjustment) ? <Row label={t("rounding")} value={formatAmount(sale.roundingAdjustment)} /> : null}
            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
              <dt className="text-base font-semibold text-ink">{t("total")}</dt>
              <dd className="text-2xl font-bold text-ink tabular-nums">{formatAmount(sale.total)}</dd>
            </div>
            {parked ? null : <Row label={t("paid")} value={formatAmount(sale.paymentState?.receivedAmount ?? sale.paidAmount)} />}
            {nonZero(sale.paymentState?.refundedAmount) ? <Row label={t("moneyReturned")} value={formatAmount(sale.paymentState?.refundedAmount)} /> : null}
            {nonZero(sale.paymentState?.creditReleasedAmount) ? <Row label={t("creditReleased")} value={formatAmount(sale.paymentState?.creditReleasedAmount)} /> : null}
            {nonZero(sale.paymentState?.writtenOffAmount) ? <Row label={t("writtenOff")} value={formatAmount(sale.paymentState?.writtenOffAmount)} /> : null}
            {nonZero(sale.paymentState?.outstandingAmount ?? sale.dueAmount) ? <Row label={t("due")} strong value={formatAmount(sale.paymentState?.outstandingAmount ?? sale.dueAmount)} /> : null}
          </dl>

          {sale.payments?.length ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">{t("payments")}</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {sale.payments.map((payment, index) => (
                  <li className="flex items-start justify-between gap-4 rounded-button bg-surface px-4 py-2" key={index}>
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{codes("method", payment.method)}</span>
                      {payment.referenceNo ? (
                        <span className="block text-xs text-slate">{t("reference")} {payment.referenceNo}</span>
                      ) : null}
                    </span>
                    <span className="text-right tabular-nums">
                      <span className="block font-semibold">{formatAmount(payment.amount)}</span>
                      {nonZero(payment.changeAmount) ? (
                        <span className="block font-semibold text-teal">{t("change")} {formatAmount(payment.changeAmount)}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Panel>

      {parked ? (
        <Panel title={t("chargeCart")}>
          <form className="flex flex-col gap-4" onSubmit={(event) => void completeCart(event)}>
            <p className="text-sm text-slate">{t("heldPrices")}</p>
            <SelectField label={t("payMethod")} onChange={(event) => setPayMethod(event.target.value as typeof payMethod)} value={payMethod}>
              {payMethods.filter((value) => value !== "CREDIT" || sale.customerId).map((value) => (
                <option key={value} value={value}>{codes("method", value)}</option>
              ))}
            </SelectField>
            {payMethod !== "CASH" && payMethod !== "CREDIT" ? (
              <Field label={t("reference")} onChange={(event) => setPayReference(event.target.value)} value={payReference} />
            ) : null}
            {error ? <Alert>{error}</Alert> : null}
            <Button busy={busy === "charge"} className="w-full" disabled={busy === "void"} size="lg" type="submit">
              {t("charge", { total: formatAmount(sale.total) })}
            </Button>
          </form>
          <div className="mt-6 border-t border-line pt-6">
            <ConfirmButton
              busy={busy === "void"}
              confirmLabel={t("voidConfirm")}
              label={t("voidCart")}
              onConfirm={() => void voidCart()}
              question={t("voidQuestion")}
            />
          </div>
        </Panel>
      ) : null}

      {returnable ? (
        <Panel title={t("returnTitle")}>
          <form className="flex flex-col gap-4" onSubmit={(event) => void submitReturn(event)}>
            <ul className="flex flex-col divide-y divide-line">
              {lines.map((line) => line.id ? (
                <li className="grid items-end gap-2 py-4 first:pt-0 sm:grid-cols-[1fr_10rem_auto] sm:gap-4" key={line.id}>
                  <p className="text-sm font-semibold text-ink sm:self-center">
                    {line.productName ?? line.productId}
                    <span className="block text-xs font-normal text-slate tabular-nums">× {formatQuantity(line.quantity)}</span>
                  </p>
                  <Field
                    inputMode="decimal"
                    label={t("returnQty")}
                    onChange={(event) => setQuantities({ ...quantities, [line.id!]: event.target.value })}
                    value={quantities[line.id] ?? ""}
                  />
                  <Checkbox
                    checked={restock[line.id] !== false}
                    label={t("restock")}
                    onChange={(event) => setRestock({ ...restock, [line.id!]: event.target.checked })}
                  />
                </li>
              ) : null)}
            </ul>
            <SelectField label={t("refundMethod")} onChange={(event) => setMethod(event.target.value as typeof method)} value={method}>
              {methods.map((value) => (
                <option key={value} value={value}>{codes("method", value)}</option>
              ))}
            </SelectField>
            <Field label={t("reason")} onChange={(event) => setReason(event.target.value)} value={reason} />
            <Field label={t("reference")} onChange={(event) => setReference(event.target.value)} value={reference} />
            {error ? <Alert>{error}</Alert> : null}
            <Button busy={busy === "return"} className="self-start" type="submit" variant="secondary">{t("submitReturn")}</Button>
          </form>
        </Panel>
      ) : null}
    </Page>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-semibold text-amber-800" : "text-slate"}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold text-amber-800" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
