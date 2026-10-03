"use client";

import { useEffect, useId, useState } from "react";
import Decimal from "decimal.js";
import { useLocale, useTranslations } from "next-intl";

import { CheckCircleIcon, PlusIcon, PrinterIcon } from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
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
import { takeJustSold } from "@/lib/just-sold";
import { formatAmount, formatQuantity } from "@/lib/money";
import { messageFor, readJson, readResponse } from "@/lib/read-json";

type SaleLine = Schemas["SaleLineView"];
type Sale = Schemas["SaleView"];

const refundMethods = ["CASH", "KBZ_PAY", "WAVE_PAY", "AYA_PAY", "CB_PAY", "BANK_TRANSFER", "OTHER", "CREDIT"] as const;
const payMethods = ["CASH", "KBZ_PAY", "WAVE_PAY", "AYA_PAY", "CB_PAY", "BANK_TRANSFER", "OTHER", "CREDIT"] as const;

/** A figure is worth a row on the receipt only when it is not zero. */
function nonZero(value?: number | string) {
  return value != null && !new Decimal(value).isZero();
}

/** The sale's date and time as the shop's clock read it, wherever the phone is. */
function soldAt(sale: Sale, locale: string, timezone?: string) {
  if (!sale.soldAt) {
    return undefined;
  }
  const options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone }).format(new Date(sale.soldAt));
  } catch {
    return new Intl.DateTimeFormat(locale, options).format(new Date(sale.soldAt));
  }
}

export function SaleReceipt({ saleId }: { saleId: string }) {
  const t = useTranslations("receipt");
  const errors = useTranslations("errors");
  const codes = useCodes();
  const locale = useLocale();
  const [sale, setSale] = useState<Sale>();
  const [organization, setOrganization] = useState<Schemas["OrganizationView"]>();
  const [locations, setLocations] = useState<Schemas["LocationView"][]>([]);
  const [justSold, setJustSold] = useState(false);
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
  const bannerTitle = useId();

  useEffect(() => {
    void readJson<Sale>(`/api/sales/${saleId}`).then(setSale)
      .catch(caught=>setError(messageFor(caught, errors, code=>errors.has(code))));
  }, [saleId, errors]);

  // the paper's heading: the shop and the store. The receipt is whole without them.
  useEffect(() => {
    void readJson<Schemas["OrganizationView"]>("/api/catalog/organization").then(setOrganization).catch(() => undefined);
    void readJson<Schemas["LocationView"][]>("/api/org/locations").then(setLocations).catch(() => undefined);
  }, []);

  // charged a moment ago on this tab: greet the cashier with the change to give, once
  useEffect(() => {
    const timer = setTimeout(() => setJustSold(takeJustSold(saleId)));
    return () => clearTimeout(timer);
  }, [saleId]);

  if (!sale) {
    return error ? <Page><Alert>{error}</Alert></Page> : <PageLoading panels={2} />;
  }

  const lines = (sale.lines ?? []) as SaleLine[];
  const creditSale = (sale.payments ?? []).some((payment) => payment.method === "CREDIT")
    || (sale.dueAmount != null && new Decimal(sale.dueAmount).gt(0));
  const returnable = sale.status === "COMPLETED" || sale.status === "PARTIALLY_REFUNDED";
  const parked = sale.status === "HELD" || sale.status === "DRAFT";
  const when = soldAt(sale, locale, organization?.timezone);
  const tone = sale.status === "COMPLETED" ? "ok" : parked ? "warn" : sale.status === "VOID" ? "bad" : "muted";
  const store = locations.find((row) => row.id === sale.locationId);
  const change = (sale.payments ?? []).reduce((sum, payment) => sum.plus(payment.changeAmount ?? 0), new Decimal(0));
  const due = sale.paymentState?.outstandingAmount ?? sale.dueAmount;
  // the receipt stands alone when nothing else can be done with this sale
  const side = Boolean(sale.paymentState) || parked || returnable;

  /** Charge a held cart for its whole total with one payment. */
  async function completeCart(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy("charge");
    try {
      const done = await readJson<Sale>(`/api/sales/${saleId}/complete`, {
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
      setJustSold(true);
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
        const shift = await readJson<Schemas["ShiftView"] | null>(`/api/sales/shifts?locationId=${sale.locationId}`);
        cashierShiftId = shift?.status === "OPEN" ? shift.id : undefined;
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
      setJustSold(false);
      setSale(await readJson<Sale>(`/api/sales/${saleId}`));
    } catch (caught) {
      setError(messageFor(caught, errors, (code) => errors.has(code)));
    } finally {
      setBusy(undefined);
    }
  }

  const print = (
    <Button onClick={() => window.print()} title={t("printHint")} type="button" variant="secondary">
      <PrinterIcon className="size-4" />
      {t("print")}
    </Button>
  );

  return (
    <Page className="print:max-w-none print:p-0!">
      <div className="print:hidden">
        <PageHeader
          actions={justSold ? null : (
            <>
              {parked ? null : print}
              <ButtonLink href="/sales/new">
                <PlusIcon className="size-4" />
                {t("newSale")}
              </ButtonLink>
            </>
          )}
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
      </div>

      {justSold ? (
        <section
          aria-labelledby={bannerTitle}
          aria-live="polite"
          className="flex flex-col gap-5 rounded-panel bg-navy p-5 text-white shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6 print:hidden"
        >
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="mt-1 size-7 shrink-0 text-brand" />
            <div>
              <h2 className="font-display text-xl font-bold" id={bannerTitle}>{t("saleComplete")}</h2>
              {change.gt(0) ? (
                <p className="mt-1 flex flex-col">
                  <span className="text-sm text-white/75">{t("changeToGive")}</span>
                  <span className="font-display text-4xl leading-tight font-bold text-brand tabular-nums">{formatAmount(change.toString())}</span>
                </p>
              ) : nonZero(due) ? (
                <p className="mt-1 flex flex-col">
                  <span className="text-sm text-white/75">{t("due")}</span>
                  <span className="font-display text-3xl leading-tight font-bold text-brand tabular-nums">{formatAmount(due)}</span>
                </p>
              ) : (
                <p className="mt-1 flex flex-col">
                  <span className="text-sm text-white/75">{t("paidInFull")}</span>
                  <span className="font-display text-3xl leading-tight font-bold tabular-nums">{formatAmount(sale.total)}</span>
                </p>
              )}
            </div>
          </div>
          {/* a phone stacks them, the next sale on top: side by side, Burmese words break mid-word */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap">
            {print}
            <ButtonLink href="/sales/new" size="lg">
              <PlusIcon className="size-5" />
              {t("newSale")}
            </ButtonLink>
          </div>
        </section>
      ) : null}
      {/* above the receipt: a return of everything closes the Return form it came from */}
      {notice ? <div className="print:hidden"><Alert tone="success">{notice}</Alert></div> : null}

      <div className={`grid items-start gap-6 print:block ${side ? "lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]" : ""}`}>
        <ReceiptPaper organization={organization} sale={sale} store={store} when={when} />

        {side ? (
          <div className="flex min-w-0 flex-col gap-6 print:hidden">
            {sale.paymentState ? <SaleWorkflow sale={sale} onSaved={setSale} /> : null}

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
          </div>
        ) : null}
      </div>
    </Page>
  );
}

/**
 * The receipt as a shop hands it over: the shop at the top, the goods, the money, a thank-you.
 * On screen it is a slip of paper with a torn foot; printed, it is black on white at the
 * printer's width (58 or 80 mm), and nothing else on the page prints.
 */
function ReceiptPaper({
  sale,
  organization,
  store,
  when,
}: {
  sale: Sale;
  organization?: Schemas["OrganizationView"];
  store?: Schemas["LocationView"];
  when?: string;
}) {
  const t = useTranslations("receipt");
  const codes = useCodes();
  const lines = (sale.lines ?? []) as SaleLine[];
  const parked = sale.status === "HELD" || sale.status === "DRAFT";
  const discounts = new Decimal(sale.lineDiscountTotal ?? 0).plus(sale.cartDiscountAmount ?? 0);
  const due = sale.paymentState?.outstandingAmount ?? sale.dueAmount;
  const rule = "my-4 border-0 border-t border-dashed border-slate-300 print:my-2 print:border-black";

  return (
    <div className="mx-auto w-full max-w-[26rem] drop-shadow-[0_1px_1px_rgb(11_30_67/0.08)] lg:mx-0 print:max-w-[80mm] print:drop-shadow-none">
      <article
        aria-label={[t("receiptNo"), sale.receiptNumber].filter(Boolean).join(" ")}
        className="receipt-paper receipt-edge bg-white px-5 pt-6 pb-10 text-sm text-ink sm:px-7 print:p-0!"
      >
        <header className="flex flex-col items-center gap-0.5 text-center">
          {organization?.name ? <p className="font-display text-xl leading-tight font-bold break-words">{organization.name}</p> : null}
          {store?.name ? <p className="font-medium text-slate">{store.name}</p> : null}
          {store?.address ? <p className="text-xs text-slate">{store.address}</p> : null}
          {store?.phone ? <p className="text-xs text-slate tabular-nums">{store.phone}</p> : null}
        </header>
        <hr className={rule} />

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
          <dt className="text-slate">{t("receiptNo")}</dt>
          <dd className="text-right font-mono font-semibold">{sale.receiptNumber ?? t("parked")}</dd>
          {when ? (
            <>
              <dt className="text-slate">{t("date")}</dt>
              <dd className="text-right">{when}</dd>
            </>
          ) : null}
          <dt className="text-slate">{t("type")}</dt>
          <dd className="text-right">{codes("channel", sale.channel)}</dd>
          <dt className="text-slate">{t("customer")}</dt>
          <dd className="text-right break-words">{sale.customerId ? sale.customerName ?? sale.customerId : t("walkIn")}</dd>
        </dl>
        <hr className={rule} />

        <h2 className="sr-only">{t("items")}</h2>
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <li key={line.id ?? line.position}>
              <p className="font-medium break-words">{line.productName ?? line.productId}</p>
              <p className="flex items-baseline justify-between gap-4">
                <span className="font-mono text-xs text-slate tabular-nums">
                  {formatQuantity(line.quantity)} × {formatAmount(line.unitPrice)}
                </span>
                <span className="font-mono tabular-nums">{formatAmount(line.lineTotal)}</span>
              </p>
              {nonZero(line.discountAmount) ? (
                <p className="flex items-baseline justify-between gap-4 text-xs text-teal">
                  <span>{t("saving")}</span>
                  <span className="font-mono tabular-nums">−{formatAmount(line.discountAmount)}</span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <hr className={rule} />

        <dl className="flex flex-col gap-1">
          <Row label={t("subtotal")} value={formatAmount(sale.subtotal)} />
          {discounts.isZero() ? null : <Row label={t("discounts")} value={`−${formatAmount(discounts.toString())}`} />}
          {nonZero(sale.taxAmount) ? (
            <Row label={sale.taxInclusive ? t("taxIncluded") : t("tax")} value={formatAmount(sale.taxAmount)} />
          ) : null}
          {nonZero(sale.roundingAdjustment) ? <Row label={t("rounding")} value={formatAmount(sale.roundingAdjustment)} /> : null}
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-slate-300 pt-2 print:border-black">
            <dt className="font-display text-base font-bold">{t("total")}</dt>
            <dd className="font-display text-2xl leading-tight font-bold tabular-nums">
              {formatAmount(sale.total)}
              {organization?.currencyCode ? <span className="ml-1.5 font-sans text-xs font-semibold text-slate">{organization.currencyCode}</span> : null}
            </dd>
          </div>
        </dl>

        {sale.payments?.length ? (
          <>
            <hr className={rule} />
            <h2 className="sr-only">{t("payments")}</h2>
            <ul className="flex flex-col gap-2">
              {sale.payments.map((payment, index) => (
                <li key={index}>
                  <p className="flex items-baseline justify-between gap-4">
                    <span className="font-medium">{codes("method", payment.method)}</span>
                    <span className="font-mono tabular-nums">{formatAmount(payment.amount)}</span>
                  </p>
                  {payment.referenceNo ? (
                    <p className="text-xs break-all text-slate">{t("reference")} {payment.referenceNo}</p>
                  ) : null}
                  {payment.method === "CASH" && payment.tenderedAmount != null && nonZero(payment.changeAmount) ? (
                    <p className="flex items-baseline justify-between gap-4 text-xs text-slate">
                      <span>{t("cashGiven")}</span>
                      <span className="font-mono tabular-nums">{formatAmount(payment.tenderedAmount)}</span>
                    </p>
                  ) : null}
                  {nonZero(payment.changeAmount) ? (
                    <p className="flex items-baseline justify-between gap-4 font-semibold text-teal">
                      <span>{t("change")}</span>
                      <span className="font-mono tabular-nums">{formatAmount(payment.changeAmount)}</span>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {parked ? null : (
          <>
            <hr className={rule} />
            <dl className="flex flex-col gap-1">
              <Row label={t("paid")} value={formatAmount(sale.paymentState?.receivedAmount ?? sale.paidAmount)} />
              {nonZero(sale.paymentState?.refundedAmount) ? <Row label={t("moneyReturned")} value={formatAmount(sale.paymentState?.refundedAmount)} /> : null}
              {nonZero(sale.paymentState?.creditReleasedAmount) ? <Row label={t("creditReleased")} value={formatAmount(sale.paymentState?.creditReleasedAmount)} /> : null}
              {nonZero(sale.paymentState?.writtenOffAmount) ? <Row label={t("writtenOff")} value={formatAmount(sale.paymentState?.writtenOffAmount)} /> : null}
              {nonZero(due) ? <Row label={t("due")} strong value={formatAmount(due)} /> : null}
            </dl>
          </>
        )}

        <hr className={rule} />
        <p className="text-center text-sm font-medium">{t("thanks")}</p>
      </article>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-semibold text-brand-ink" : "text-slate"}>{label}</dt>
      <dd className={`font-mono tabular-nums ${strong ? "font-semibold text-brand-ink" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
