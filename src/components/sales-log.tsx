"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { PlusIcon, ReceiptIcon } from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  Field,
  insetFocusRing,
  LoadingRows,
  Page,
  PageHeader,
  Panel,
  SelectField,
} from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { SaleStates } from "@/components/sale-states";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { formatAmount } from "@/lib/money";
import { messageFor, readJson } from "@/lib/read-json";

type Row = Schemas["SaleSummaryView"];

const done = ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"];
const parked = ["HELD", "DRAFT"];

/** The sales log (completed sales, newest first) or, with {@code held}, the parked carts. */
export function SalesLog({ held = false }: { held?: boolean }) {
  const t = useTranslations("salesLog");
  const shell = useTranslations("shell");
  const errors = useTranslations("errors");
  const codes = useCodes();
  const [rows, setRows] = useState<Row[]>([]);
  const [show, setShow] = useState<"done" | "all">("done");
  const [progress, setProgress] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    const search = new URLSearchParams();
    for (const status of held ? parked : show === "done" ? done : []) {
      search.append("status", status);
    }
    if (from) {
      search.set("from", from);
    }
    if (to) {
      search.set("to", to);
    }
    if (!held && progress) search.set("progress", progress);
    if (!held && paymentStatus) search.set("paymentStatus", paymentStatus);
    search.set("limit", "200");
    // state changes only once the answer is in, never synchronously inside the effect
    return readJson<Row[]>(`/api/sales?${search}`)
      .then((found) => {
        setRows(found);
        setError(undefined);
      })
      .catch((caught) => setError(messageFor(caught, errors, (code) => errors.has(code))))
      .finally(() => setLoaded(true));
  }, [held, show, from, to, progress, paymentStatus, errors]);

  useEffect(() => {
    void load();
  }, [load]);

  const newSale = (variant: "primary" | "secondary") => (
    <ButtonLink href="/sales/new" variant={variant}>
      <PlusIcon className="size-5" />
      {shell("newSale")}
    </ButtonLink>
  );

  return (
    <Page>
      <PageHeader
        actions={newSale("primary")}
        subtitle={held ? t("heldSubtitle") : t("subtitle")}
        title={held ? t("heldTitle") : t("title")}
      />
      {held ? null : (
        <Panel>
          <form
            className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
          >
            <SelectField className="col-span-2 lg:col-span-1" label={t("show")} onChange={(event) => setShow(event.target.value as typeof show)} value={show}>
              <option value="done">{t("showDone")}</option>
              <option value="all">{t("showAll")}</option>
            </SelectField>
            <SelectField label={t("progress")} value={progress} onChange={event=>setProgress(event.target.value)}>
              <option value="">{t("anyProgress")}</option>
              {["OPEN","CLOSED","CANCELED"].map(value=><option key={value} value={value}>{codes("saleProgress",value)}</option>)}
            </SelectField>
            <SelectField label={t("paymentStatus")} value={paymentStatus} onChange={event=>setPaymentStatus(event.target.value)}>
              <option value="">{t("anyPayment")}</option>
              {["PAID","DEPOSIT","UNPAID","REFUNDED"].map(value=><option key={value} value={value}>{codes("salePayment",value)}</option>)}
            </SelectField>
            <Field label={t("from")} onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
            <Field label={t("to")} onChange={(event) => setTo(event.target.value)} type="date" value={to} />
            <Button busy={refreshing} className="col-span-2 lg:col-span-1" type="submit" variant="secondary">{t("refresh")}</Button>
          </form>
          <p className="mt-2 text-xs text-slate">{t("rangeHint")}</p>
        </Panel>
      )}
      {error ? <Alert>{error}</Alert> : null}
      {!loaded ? (
        <LoadingRows rows={6} />
      ) : rows.length === 0 ? (
        error ? null : (
          <EmptyState action={newSale("secondary")} icon={<ReceiptIcon className="size-6" />} title={held ? t("noHeld") : t("none")} />
        )
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-panel border border-line bg-white shadow-xs">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                className={`flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-slate-50 motion-reduce:transition-none ${insetFocusRing}`}
                href={`/sales/${row.id}`}
              >
                <span className="flex min-w-0 flex-col gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{row.receiptNumber ?? t("parked")}</span>
                    <Badge tone={row.channel === "ONLINE" ? "info" : "muted"}>{codes("channel", row.channel)}</Badge>
                    <SaleStates sale={row} />
                    {row.status !== "COMPLETED" && row.progress !== "CANCELED" ? (
                      <Badge tone={row.status === "HELD" || row.status === "DRAFT" ? "warn" : row.status === "VOID" ? "bad" : "muted"}>
                        {row.status === "REFUNDED" ? t("allItemsReturned") : codes("saleStatus", row.status)}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-xs text-slate">
                    {new Date((row.soldAt ?? row.createdAt) as string).toLocaleString()} · {row.customerName ?? t("walkIn")} ·{" "}
                    {t("items", { count: row.lineCount ?? 0 })}
                  </span>
                </span>
                <span className="shrink-0 text-right text-base font-semibold text-ink tabular-nums">{formatAmount(row.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
