"use client";

import { useCallback, useEffect, useState } from "react";
import Decimal from "decimal.js";
import { useLocale, useTranslations } from "next-intl";

import { ChevronDownIcon, GlobeIcon, PlusIcon, ReceiptIcon, StoreIcon } from "@/components/icons";
import { Alert, Badge, Button, ButtonLink, EmptyState, focusRing, LoadingRows, Page, PageHeader, SearchField } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { localDate, shiftDays } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { messageFor, readJson } from "@/lib/read-json";
import { matchesWords } from "@/lib/search";

type Row = Schemas["SaleSummaryView"];
type Org = Schemas["OrganizationView"];
/** Which days are shown: a quick choice counted back from today, or two dates of the reader's own. */
type Range = "today" | "week" | "thirty" | "month" | "custom";

const done = ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"];
const parked = ["HELD", "DRAFT"];
const ranges: Range[] = ["today", "week", "thirty", "month", "custom"];

/** The sales log (completed sales, newest first) or, with {@code held}, the parked carts. */
export function SalesLog({ held = false }: { held?: boolean }) {
  const t = useTranslations("salesLog");
  const shell = useTranslations("shell");
  const errors = useTranslations("errors");
  const codes = useCodes();
  const locale = useLocale();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [org, setOrg] = useState<Org>();
  const [show, setShow] = useState<"done" | "all">("done");
  const [progress, setProgress] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [type, setType] = useState<"" | "ONLINE" | "OFFLINE">("");
  const [range, setRange] = useState<Range>("thirty");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void readJson<Org>("/api/catalog/organization").then(setOrg).catch(() => undefined);
  }, []);

  // with no dates the API shows the last 30 days; the other quick choices count back in the shop's timezone
  const today = org?.timezone ? localDate(org.timezone) : undefined;
  const dates =
    range === "custom"
      ? { from, to }
      : !today || range === "thirty"
        ? { from: "", to: "" }
        : range === "today"
          ? { from: today, to: today }
          : range === "week"
            ? { from: shiftDays(today, -6), to: today }
            : { from: `${today.slice(0, 8)}01`, to: today };

  const load = useCallback(() => {
    const search = new URLSearchParams();
    for (const status of held ? parked : show === "done" ? done : []) {
      search.append("status", status);
    }
    if (dates.from) {
      search.set("from", dates.from);
    }
    if (dates.to) {
      search.set("to", dates.to);
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
  }, [held, show, dates.from, dates.to, progress, paymentStatus, errors]);

  useEffect(() => {
    void load();
  }, [load]);

  // the order type and the search narrow what is already loaded
  const needle = query.trim().toLowerCase();
  const visible = rows.filter(
    (row) =>
      (!type || (type === "ONLINE") === (row.channel === "ONLINE")) &&
      (!needle || matchesWords(needle, row.receiptNumber, row.customerName)),
  );
  const filtering = Boolean(needle || type || progress || paymentStatus || show !== "done" || range !== "thirty");
  const total = visible.reduce((sum, row) => sum.plus(row.total ?? 0), new Decimal(0));

  function clear() {
    setQuery("");
    setType("");
    setProgress("");
    setPaymentStatus("");
    setShow("done");
    setRange("thirty");
    setFrom("");
    setTo("");
  }

  const when = (value?: string) => {
    if (!value) {
      return "—";
    }
    const date = new Date(value);
    const thisYear = date.getFullYear() === new Date().getFullYear();
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      ...(thisYear ? {} : { year: "numeric" }),
      hour: "numeric",
      minute: "2-digit",
      ...(org?.timezone ? { timeZone: org.timezone } : {}),
    }).format(date);
  };

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
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchField className="lg:w-80 lg:shrink-0" label={t("search")} onChange={(event) => setQuery(event.target.value)} value={query} />
            <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
              <div aria-label={t("dates")} className="flex w-max gap-1 rounded-xl border border-line bg-white p-1 shadow-xs" role="group">
                {ranges.map((option) => (
                  <button
                    aria-pressed={range === option}
                    className={`min-h-10 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none sm:min-h-8 ${focusRing} ${
                      range === option ? "bg-navy text-white shadow-xs" : "text-slate hover:bg-surface hover:text-ink"
                    }`}
                    key={option}
                    onClick={() => setRange(option)}
                    type="button"
                  >
                    {t(`ranges.${option}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            <Pill active={show !== "done"} label={t("show")} onChange={(value) => setShow(value as typeof show)} value={show}>
              <option value="done">{t("showDone")}</option>
              <option value="all">{t("showAll")}</option>
            </Pill>
            <Pill active={type !== ""} label={t("type")} onChange={(value) => setType(value as typeof type)} value={type}>
              <option value="">{t("all")}</option>
              <option value="ONLINE">{t("online")}</option>
              <option value="OFFLINE">{t("offline")}</option>
            </Pill>
            <Pill active={progress !== ""} label={t("progress")} onChange={setProgress} value={progress}>
              <option value="">{t("all")}</option>
              {["OPEN", "CLOSED", "CANCELED"].map((value) => (
                <option key={value} value={value}>{codes("saleProgress", value)}</option>
              ))}
            </Pill>
            <Pill active={paymentStatus !== ""} label={t("paymentStatus")} onChange={setPaymentStatus} value={paymentStatus}>
              <option value="">{t("all")}</option>
              {["PAID", "DEPOSIT", "UNPAID", "REFUNDED"].map((value) => (
                <option key={value} value={value}>{codes("salePayment", value)}</option>
              ))}
            </Pill>
            {range === "custom" ? (
              <>
                <DatePill label={t("from")} onChange={setFrom} value={from} />
                <DatePill label={t("to")} onChange={setTo} value={to} />
              </>
            ) : null}
          </div>
        </div>
      )}
      {error ? <Alert>{error}</Alert> : null}
      {!loaded ? (
        <LoadingRows rows={6} />
      ) : visible.length === 0 ? (
        error ? null : filtering ? (
          <EmptyState
            action={<Button onClick={clear} type="button" variant="secondary">{t("clear")}</Button>}
            icon={<ReceiptIcon className="size-6" />}
            title={t("noMatch")}
          />
        ) : (
          <EmptyState action={newSale("secondary")} icon={<ReceiptIcon className="size-6" />} title={held ? t("noHeld") : t("none")} />
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-slate">
              <span className="font-semibold text-ink">{t("count", { count: visible.length })}</span>
              {" · "}
              <span className="tabular-nums">{formatAmount(total.toString())} {org?.currencyCode ?? ""}</span>
            </p>
            {filtering ? (
              <button className={`rounded-sm text-sm font-semibold text-brand-ink hover:underline ${focusRing}`} onClick={clear} type="button">
                {t("clear")}
              </button>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-panel border border-line bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface/70 text-xs font-semibold text-slate">
                  <tr>
                    <th className="px-4 py-3 sm:pl-6" scope="col">
                      <span className="md:hidden">{t("colSale")}</span>
                      <span className="hidden md:inline">{t("colReceipt")}</span>
                    </th>
                    <th className="hidden px-4 py-3 md:table-cell" scope="col">{t("colDate")}</th>
                    <th className="hidden px-4 py-3 md:table-cell" scope="col">{t("colCustomer")}</th>
                    <th className="hidden px-4 py-3 md:table-cell" scope="col">{t("type")}</th>
                    <th className="hidden px-4 py-3 text-right lg:table-cell" scope="col">{t("colItems")}</th>
                    <th className="hidden px-4 py-3 md:table-cell" scope="col">{t("progress")}</th>
                    <th className="hidden px-4 py-3 md:table-cell" scope="col">{t("paymentStatus")}</th>
                    <th className="px-4 py-3 text-right sm:pr-6" scope="col">{t("colTotal")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((row) => {
                    const href = `/sales/${row.id}`;
                    const online = row.channel === "ONLINE";
                    const status = row.paymentState?.status;
                    const progressBadge = row.paymentState ? (
                      <Badge tone={row.progress === "CANCELED" ? "bad" : row.progress === "OPEN" ? "info" : "muted"}>
                        {codes("saleProgress", row.progress)}
                      </Badge>
                    ) : null;
                    const paymentBadge = status ? (
                      <Badge tone={status === "PAID" ? "ok" : status === "DEPOSIT" ? "warn" : "muted"}>{codes("salePayment", status)}</Badge>
                    ) : null;
                    const customer = row.customerName ?? t("walkIn");
                    return (
                      <tr
                        className="cursor-pointer transition-colors hover:bg-surface motion-reduce:transition-none"
                        key={row.id}
                        onClick={(event) => {
                          // the whole row opens the sale; the receipt number is the link a keyboard reaches
                          if (!(event.target as Element).closest("a")) {
                            router.push(href);
                          }
                        }}
                      >
                        <td className="px-4 py-3 align-top sm:pl-6 md:align-middle">
                          <span className="flex flex-wrap items-center gap-2">
                            <Link
                              className={`rounded-sm font-mono text-[0.8125rem] font-semibold text-ink underline-offset-4 hover:text-brand-ink hover:underline ${focusRing}`}
                              href={href}
                            >
                              {row.receiptNumber ?? t("parked")}
                            </Link>
                            {row.status !== "COMPLETED" && row.progress !== "CANCELED" ? (
                              <Badge tone={row.status === "HELD" || row.status === "DRAFT" ? "warn" : row.status === "VOID" ? "bad" : "muted"}>
                                {row.status === "REFUNDED" ? t("allItemsReturned") : codes("saleStatus", row.status)}
                              </Badge>
                            ) : null}
                          </span>
                          <span className="mt-1.5 flex flex-col items-start gap-1.5 md:hidden">
                            <OrderType online={online} />
                            <span className="text-xs text-slate">
                              {when(row.soldAt ?? row.createdAt)} · {customer} · {t("items", { count: row.lineCount ?? 0 })}
                            </span>
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 whitespace-nowrap text-slate tabular-nums md:table-cell">{when(row.soldAt ?? row.createdAt)}</td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className={`block max-w-48 truncate ${row.customerName ? "font-medium text-ink" : "text-slate"}`}>{customer}</span>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell"><OrderType online={online} /></td>
                        <td className="hidden px-4 py-3 text-right text-slate tabular-nums lg:table-cell">{row.lineCount ?? 0}</td>
                        <td className="hidden px-4 py-3 md:table-cell">{progressBadge ?? <span className="text-slate">—</span>}</td>
                        <td className="hidden px-4 py-3 md:table-cell">{paymentBadge ?? <span className="text-slate">—</span>}</td>
                        <td className="px-4 py-3 text-right align-top sm:pr-6 md:align-middle">
                          <span className="block font-semibold whitespace-nowrap text-ink tabular-nums">{formatAmount(row.total)}</span>
                          <span className="mt-1.5 flex flex-col items-end gap-1 md:hidden">
                            {paymentBadge}
                            {progressBadge}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

/** Online or offline (in the shop), with an icon so the column can be scanned at a glance. */
function OrderType({ online }: { online: boolean }) {
  const t = useTranslations("salesLog");
  const Icon = online ? GlobeIcon : StoreIcon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
        online ? "bg-[#e8f0fe] text-sky" : "bg-slate-100 text-slate-700"
      }`}
    >
      <Icon className="size-3.5" />
      {online ? t("online") : t("offline")}
    </span>
  );
}

/** A filter as a small pill: its name, then its choice. Navy while it narrows the list. */
function Pill({
  label,
  value,
  onChange,
  active,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`relative inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border pr-8 pl-3.5 text-sm whitespace-nowrap shadow-xs transition-colors motion-reduce:transition-none sm:min-h-9 ${
        active ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-slate-300"
      }`}
    >
      <span className={active ? "text-white/75" : "text-slate"}>{label}</span>
      <select
        className="max-w-44 cursor-pointer appearance-none truncate bg-transparent font-semibold [&_option]:text-ink"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
      <ChevronDownIcon className={`pointer-events-none absolute right-3 size-4 ${active ? "text-white/80" : "text-slate"}`} />
    </label>
  );
}

/** One end of a custom date range, as a pill. */
function DatePill({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-sm shadow-xs sm:min-h-9">
      <span className="text-slate">{label}</span>
      <input className="bg-transparent font-semibold text-ink tabular-nums" onChange={(event) => onChange(event.target.value)} type="date" value={value} />
    </label>
  );
}
