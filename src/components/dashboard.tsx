"use client";

import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { useLocale, useTranslations } from "next-intl";

import { ColumnChart, Donut, type Column } from "@/components/charts";
import {
  ArrowDownLeftIcon,
  ArrowRightIcon,
  ChartIcon,
  CheckCircleIcon,
  PieIcon,
  PlusIcon,
  ReceiptIcon,
  ReturnIcon,
  TrendDownIcon,
  TrendUpIcon,
  TruckIcon,
  WalletIcon,
  WarningIcon,
} from "@/components/icons";
import {
  Alert,
  Badge,
  ButtonLink,
  focusRing,
  insetFocusRing,
  linkClasses,
  LoadingRows,
  Monogram,
  Page,
  PageHeader,
  Panel,
  Skeleton,
} from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { formatAmount, formatQuantity } from "@/lib/money";
import { messageFor, readJson } from "@/lib/read-json";
import { useMembershipRole } from "@/lib/role";

type Org = Schemas["OrganizationView"];
type Summary = Schemas["Summary"];
type Day = Schemas["DayTotal"];
type Top = Schemas["ProductTotal"];
type Low = Schemas["LowStockRow"];
type Mix = Schemas["PaymentMixRow"];
type SaleRow = Schemas["SaleSummaryView"];

type Period = "today" | "month";
/** What one period shows, with the period it is compared with. */
type PeriodReports = { current: Summary; previous: Summary; top: Top[]; mix: Mix[] };
/** What does not depend on the period. */
type Shared = { days: Day[]; low: Low[]; latest: SaleRow[] };

const chartRanges = [7, 14, 30] as const;

const methodColours: Record<string, string> = {
  CASH: "var(--teal)",
  KBZ_PAY: "var(--sky)",
  WAVE_PAY: "var(--brand)",
  AYA_PAY: "#e11d48",
  CB_PAY: "#7c3aed",
  BANK_TRANSFER: "var(--navy)",
  CREDIT: "#94a3b8",
  OTHER: "#cbd5e1",
};

/** YYYY-MM-DD in the shop's own timezone, whatever the phone's clock is set to. */
function localDate(timezone: string, date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date);
}

function shiftDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The period's dates, and the ones it is compared with: yesterday, or the same days of last month. */
function rangeOf(period: Period, today: string) {
  if (period === "today") {
    const yesterday = shiftDays(today, -1);
    return { from: today, to: today, previousFrom: yesterday, previousTo: yesterday };
  }
  const [year, month, day] = today.split("-").map(Number);
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  const lastDay = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate();
  const mm = String(previousMonth).padStart(2, "0");
  return {
    from: `${today.slice(0, 8)}01`,
    to: today,
    previousFrom: `${previousYear}-${mm}-01`,
    previousTo: `${previousYear}-${mm}-${String(Math.min(day, lastDay)).padStart(2, "0")}`,
  };
}

/** Whole percent change against the earlier period; nothing when there is nothing to compare with. */
function change(current?: number, previous?: number) {
  if (current === undefined || !previous) {
    return undefined;
  }
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function Dashboard() {
  const t = useTranslations("dashboard");
  const shell = useTranslations("shell");
  const sale = useTranslations("sale");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const codes = useCodes();
  const locale = useLocale();
  const { managesStock, ready } = useMembershipRole();
  const [org, setOrg] = useState<Org>();
  const [period, setPeriod] = useState<Period>("today");
  const [reports, setReports] = useState<Partial<Record<Period, PeriodReports>>>({});
  const [shared, setShared] = useState<Shared>();
  const [days, setDays] = useState<(typeof chartRanges)[number]>(14);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void readJson<Org>("/api/catalog/organization").then(setOrg);
  }, []);

  const timezone = org?.timezone;

  useEffect(() => {
    if (!timezone || !managesStock) {
      return;
    }
    const today = localDate(timezone);
    Promise.all([
      readJson<Day[]>(`/api/reports/sales-by-day?from=${shiftDays(today, -29)}&to=${today}`),
      readJson<Low[]>("/api/reports/low-stock?limit=50"),
      readJson<SaleRow[]>("/api/sales?status=COMPLETED&status=PARTIALLY_REFUNDED&status=REFUNDED&limit=6"),
    ])
      .then(([dayRows, low, latest]) => setShared({ days: dayRows, low, latest }))
      .catch((caught) => setError(messageFor(caught, errors, (code) => errors.has(code))));
  }, [timezone, managesStock, errors]);

  // each period is fetched the first time it is shown, then kept
  const periodLoaded = reports[period] !== undefined;
  useEffect(() => {
    if (!timezone || !managesStock || periodLoaded) {
      return;
    }
    const range = rangeOf(period, localDate(timezone));
    const dates = `from=${range.from}&to=${range.to}`;
    Promise.all([
      readJson<Summary>(`/api/reports/summary?${dates}`),
      readJson<Summary>(`/api/reports/summary?from=${range.previousFrom}&to=${range.previousTo}`),
      readJson<Top[]>(`/api/reports/top-products?${dates}&limit=5`),
      readJson<Mix[]>(`/api/reports/payment-mix?${dates}`),
    ])
      .then(([current, previous, top, mix]) => setReports((state) => ({ ...state, [period]: { current, previous, top, mix } })))
      .catch((caught) => setError(messageFor(caught, errors, (code) => errors.has(code))));
  }, [timezone, managesStock, period, periodLoaded, errors]);

  if (!ready || !org) {
    return (
      <Page>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48 rounded-button" />
          <Skeleton className="h-4 w-32 rounded-button" />
        </div>
        <TilesLoading label={common("loading")} />
      </Page>
    );
  }
  const currency = org.currencyCode ?? "";

  if (!managesStock) {
    return (
      <Page>
        <PageHeader subtitle={org.name} title={t("title")} />
        <section className="relative overflow-hidden rounded-panel bg-navy p-6 text-white shadow-card sm:p-8">
          <span aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/5" />
          <span aria-hidden="true" className="pointer-events-none absolute -right-4 -bottom-20 size-40 rounded-full bg-brand/15" />
          <h2 className="relative font-display text-2xl font-bold">{t("cashierTitle")}</h2>
          <p className="relative mt-2 max-w-xl text-sm text-white/80">{t("cashierHint")}</p>
          <ButtonLink className="relative mt-6" href="/sales/new" size="lg">
            <PlusIcon className="size-5" />
            {t("newSale")}
          </ButtonLink>
        </section>
      </Page>
    );
  }

  const now = reports[period];
  const current = now?.current;
  const trend = (value?: number, previous?: number) => {
    const percent = change(value, previous);
    if (percent === undefined) {
      return undefined;
    }
    const text = `${percent > 0 ? "+" : ""}${percent}%`;
    return { up: percent >= 0, text: period === "today" ? t("vsYesterday", { change: text }) : t("vsLastMonth", { change: text }) };
  };
  const net = current ? new Decimal(current.grossProfit ?? 0).minus(current.expenses ?? 0).toString() : undefined;
  const today = localDate(org.timezone ?? "Asia/Yangon");
  const dayName = (isoDate: string) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
      .format(new Date(`${isoDate}T00:00:00Z`));

  const series = Array.from({ length: days }, (_, index) => {
    const day = shiftDays(today, index - days + 1);
    const found = shared?.days.find((row) => row.day === day);
    return { day, sales: found?.grossSales ?? 0, profit: found?.grossProfit ?? 0, count: found?.salesCount ?? 0 };
  });
  const rangeTotal = series.reduce((sum, row) => sum.plus(row.sales), new Decimal(0));
  const columns: Column[] = series.map((row) => ({
    key: row.day,
    label: String(Number(row.day.slice(8))),
    value: Number(row.sales),
    line: Number(row.profit),
    highlight: row.day === today,
    detail: (
      <>
        <span className="block font-semibold">{dayName(row.day)}</span>
        <span className="block tabular-nums">{t("legendSales")}: {formatAmount(row.sales)}</span>
        <span className="block text-white/75 tabular-nums">
          {t("legendProfit")}: {formatAmount(row.profit)} · {t("salesCount", { count: row.count })}
        </span>
      </>
    ),
    spoken: `${dayName(row.day)}: ${t("legendSales")} ${formatAmount(row.sales)} ${currency}, ${t("legendProfit")} ${formatAmount(row.profit)} ${currency}`,
  }));

  const low = shared?.low ?? [];
  const mix = now?.mix ?? [];
  const mixTotal = mix.reduce((sum, row) => sum.plus(row.amount ?? 0), new Decimal(0));
  const topRevenue = Math.max(0, ...(now?.top ?? []).map((row) => Number(row.netRevenue ?? 0)));
  // today's sales by the time, older ones by the day: short enough for the row
  const when = (value?: string) => {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    const sameDay = localDate(org.timezone ?? "Asia/Yangon", date) === today;
    return new Intl.DateTimeFormat(
      locale,
      sameDay ? { hour: "numeric", minute: "2-digit", timeZone: org.timezone } : { day: "numeric", month: "short", timeZone: org.timezone },
    ).format(date);
  };

  return (
    <Page>
      <PageHeader actions={<PeriodToggle onChange={setPeriod} value={period} />} subtitle={org.name} title={t("title")} />
      {error ? <Alert>{error}</Alert> : null}

      {low.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-brand/40 bg-brand-soft px-4 py-3 text-sm text-navy" role="status">
          <WarningIcon className="size-5 shrink-0 text-brand-ink" />
          <p className="min-w-0 flex-1">
            <strong className="font-semibold">{t("lowBanner", { count: low.length })}</strong>{" "}
            <span className="text-navy/75">
              {low.slice(0, 3).map((row) => row.productName).join(", ")}
              {low.length > 3 ? "…" : ""}
            </span>
          </p>
          <a className={linkClasses} href="#low-stock">{t("lowBannerLink")}</a>
        </div>
      ) : null}

      {current ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <HeroTile
              currency={currency}
              icon={<ReceiptIcon className="size-5" />}
              label={t("sales")}
              note={t("salesCount", { count: current.salesCount ?? 0 })}
              tone="navy"
              trend={trend(current.grossSales, now?.previous.grossSales)}
              value={current.grossSales}
            />
            <HeroTile
              currency={currency}
              icon={<TrendUpIcon className="size-5" />}
              label={t("grossProfit")}
              note={t("profitNote")}
              tone="teal"
              trend={trend(current.grossProfit, now?.previous.grossProfit)}
              value={current.grossProfit}
            />
            <HeroTile
              currency={currency}
              href="/receivables"
              icon={<ArrowDownLeftIcon className="size-5" />}
              label={t("owedToYou")}
              note={t("owedToYouNote")}
              tone="brand"
              value={current.receivablesOutstanding}
            />
            <HeroTile
              currency={currency}
              icon={<WalletIcon className="size-5" />}
              label={t("expenses")}
              note={t("expensesNote")}
              tone="sky"
              value={current.expenses}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              currency={currency}
              icon={<CheckCircleIcon className="size-5" />}
              label={t("netProfit")}
              note={t("netProfitNote")}
              tint="bg-teal-soft text-teal"
              value={formatAmount(net)}
            />
            <StatCard
              currency={currency}
              icon={<ReturnIcon className="size-5" />}
              label={t("refunds")}
              note={t("returnCount", { count: current.returnCount ?? 0 })}
              tint="bg-[#fdecef] text-[#be123c]"
              value={formatAmount(current.refundAmount)}
            />
            <StatCard
              currency={currency}
              href="/payables"
              icon={<TruckIcon className="size-5" />}
              label={t("youOwe")}
              note={t("youOweNote")}
              tint="bg-navy-soft text-navy"
              value={formatAmount(current.payablesOutstanding)}
            />
            <StatCard
              href="#low-stock"
              icon={<WarningIcon className="size-5" />}
              label={t("lowCount")}
              note={t("lowCountNote")}
              tint="bg-brand-soft text-brand-ink"
              value={shared ? String(low.length) : "—"}
            />
          </div>
        </>
      ) : error ? null : (
        <TilesLoading label={common("loading")} />
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          actions={
            <div aria-label={t("chartRange")} className="flex rounded-lg bg-surface p-0.5" role="group">
              {chartRanges.map((option) => (
                <button
                  aria-pressed={days === option}
                  className={`min-h-9 rounded-md px-2.5 text-xs font-semibold transition-colors motion-reduce:transition-none sm:min-h-8 ${focusRing} ${
                    days === option ? "bg-white text-ink shadow-xs" : "text-slate hover:text-ink"
                  }`}
                  key={option}
                  onClick={() => setDays(option)}
                  type="button"
                >
                  {t("days", { count: option })}
                </button>
              ))}
            </div>
          }
          className="xl:col-span-2"
          icon={<ChartIcon className="size-4" />}
          title={t("chart")}
        >
          {shared ? (
            <>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <p className="flex flex-col">
                  <span className="font-display text-2xl leading-tight font-bold text-ink tabular-nums">
                    {formatAmount(rangeTotal.toString())} <span className="font-sans text-xs font-semibold text-slate">{currency}</span>
                  </span>
                  <span className="text-sm text-slate">
                    {t("chartAverage", { amount: formatAmount(rangeTotal.div(days).toFixed(0)) })}
                  </span>
                </p>
                <p aria-hidden="true" className="flex items-center gap-4 text-xs text-slate">
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand" />{t("legendSales")}</span>
                  <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full bg-teal" />{t("legendProfit")}</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-navy" />{t("today")}</span>
                </p>
              </div>
              <ColumnChart columns={columns} labelEvery={days === 30 ? 5 : 1} summary={t("chartLabel", { count: days })} />
            </>
          ) : (
            <Skeleton className="h-64 rounded-xl" />
          )}
        </Panel>

        <Panel icon={<PieIcon className="size-4" />} title={period === "today" ? t("paymentMixToday") : t("paymentMix")}>
          {!now ? (
            <LoadingRows className="h-10" rows={4} />
          ) : mix.length === 0 ? (
            <p className="text-sm text-slate">{t("nothingYet")}</p>
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row xl:flex-col">
              <Donut slices={mix.map((row) => ({ key: row.method ?? "", value: Number(row.amount ?? 0), color: methodColours[row.method ?? ""] ?? "#cbd5e1" }))}>
                <span className="text-xs text-slate">{t("mixTotal")}</span>
                <span className="font-display text-xl leading-tight font-bold text-ink tabular-nums">{formatAmount(mixTotal.toString())}</span>
              </Donut>
              <ul className="flex w-full min-w-0 flex-col gap-2.5 text-sm">
                {mix.map((row) => (
                  <li className="flex items-center gap-3" key={row.method}>
                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: methodColours[row.method ?? ""] ?? "#cbd5e1" }} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-ink">{codes("method", row.method)}</span>{" "}
                      <span className="text-slate tabular-nums">× {row.count}</span>
                    </span>
                    <span className="font-semibold text-ink tabular-nums">{formatAmount(row.amount)}</span>
                    <span className="w-10 shrink-0 text-right text-xs text-slate tabular-nums">
                      {mixTotal.isZero() ? "" : `${new Decimal(row.amount ?? 0).div(mixTotal).times(100).toFixed(0)}%`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Panel icon={<TrendUpIcon className="size-4" />} title={period === "today" ? t("topProductsToday") : t("topProducts")}>
          {!now ? (
            <LoadingRows className="h-12" rows={4} />
          ) : now.top.length === 0 ? (
            <p className="text-sm text-slate">{t("nothingYet")}</p>
          ) : (
            <ul className="-my-2 flex flex-col divide-y divide-line">
              {now.top.map((row) => (
                <li className="flex items-center gap-3 py-3" key={row.productId}>
                  <Monogram name={row.productName ?? ""} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{row.productName}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface">
                        <span
                          className="block h-full rounded-full bg-brand"
                          style={{ width: `${topRevenue > 0 ? (Number(row.netRevenue ?? 0) / topRevenue) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="text-xs text-slate tabular-nums">× {formatQuantity(row.quantity)}</span>
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="text-sm font-semibold text-ink">{formatAmount(row.netRevenue)}</p>
                    <p className="text-xs font-medium text-teal">+{formatAmount(row.grossProfit)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          actions={<Link className={`text-sm ${linkClasses}`} href="/stock">{t("restock")}</Link>}
          className="scroll-mt-24"
          icon={<WarningIcon className="size-4" />}
          id="low-stock"
          title={t("lowStock")}
        >
          {!shared ? (
            <LoadingRows className="h-12" rows={4} />
          ) : low.length === 0 ? (
            <p className="text-sm text-slate">{t("stockFine")}</p>
          ) : (
            <ul className="-my-2 flex flex-col divide-y divide-line">
              {low.slice(0, 6).map((row) => {
                const quantity = Number(row.quantity ?? 0);
                const reorder = Number(row.reorderPoint ?? 0);
                const out = quantity <= 0;
                return (
                  <li className="py-3" key={`${row.productId}-${row.locationId}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{row.productName}</span>
                        <span className="block text-xs text-slate">{row.locationCode}</span>
                      </span>
                      <Badge tone={out ? "bad" : "warn"}>
                        {formatQuantity(row.quantity)} / {row.reorderPoint}
                      </Badge>
                    </div>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface">
                      <span
                        className={`block h-full rounded-full ${out ? "bg-danger" : "bg-brand"}`}
                        style={{ width: `${reorder > 0 ? Math.min(100, Math.max(0, (quantity / reorder) * 100)) : 0}%` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          actions={<Link className={`text-sm ${linkClasses}`} href="/sales">{shell("salesLog")}</Link>}
          className="lg:col-span-2 xl:col-span-1"
          icon={<ReceiptIcon className="size-4" />}
          title={t("latestSales")}
        >
          {!shared ? (
            <LoadingRows className="h-12" rows={4} />
          ) : shared.latest.length === 0 ? (
            <p className="text-sm text-slate">{t("nothingYet")}</p>
          ) : (
            <ul className="-mx-2 -my-1 flex flex-col">
              {shared.latest.map((row) => {
                const status = row.paymentState?.status;
                return (
                  <li key={row.id}>
                    <Link
                      className={`flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface motion-reduce:transition-none ${insetFocusRing}`}
                      href={`/sales/${row.id}`}
                    >
                      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy-soft text-navy">
                        <ReceiptIcon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-1.5">
                          <span className="truncate text-sm font-semibold text-ink">{row.customerName ?? sale("walkIn")}</span>
                          <span className="shrink-0 text-xs text-slate">{when(row.soldAt ?? row.createdAt)}</span>
                        </span>
                        <span className="block truncate font-mono text-xs text-slate">{row.receiptNumber}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <span className="text-sm font-semibold text-ink tabular-nums">{formatAmount(row.total)}</span>
                        {status ? (
                          <Badge tone={status === "PAID" ? "ok" : status === "DEPOSIT" ? "warn" : status === "REFUNDED" ? "bad" : "muted"}>
                            {codes("salePayment", status)}
                          </Badge>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </Page>
  );
}

/** Today or this month: the figures, best sellers and payments all follow it. */
function PeriodToggle({ value, onChange }: { value: Period; onChange: (period: Period) => void }) {
  const t = useTranslations("dashboard");
  return (
    <div aria-label={t("period")} className="grid w-full grid-cols-2 gap-1 rounded-xl border border-line bg-white p-1 shadow-xs sm:w-auto" role="group">
      {(["today", "month"] as const).map((option) => (
        <button
          aria-pressed={value === option}
          className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors motion-reduce:transition-none ${focusRing} ${
            value === option ? "bg-navy text-white shadow-xs" : "text-slate hover:bg-surface hover:text-ink"
          }`}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option === "today" ? t("today") : t("thisMonth")}
        </button>
      ))}
    </div>
  );
}

function TilesLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4" role="status">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-40 rounded-panel" key={index} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-32 rounded-panel" key={index} />
        ))}
      </div>
    </div>
  );
}

const heroTones = {
  navy: { box: "bg-navy text-white", soft: "text-white/75", chip: "bg-white/10 text-brand", pill: "bg-white/15" },
  teal: { box: "bg-teal text-white", soft: "text-white/80", chip: "bg-white/15 text-white", pill: "bg-white/15" },
  brand: { box: "bg-brand text-navy", soft: "text-navy/75", chip: "bg-white/45 text-navy", pill: "bg-navy/10" },
  sky: { box: "bg-sky text-white", soft: "text-white/80", chip: "bg-white/15 text-white", pill: "bg-white/15" },
};

/** One of the four headline figures, on a solid colour. */
function HeroTile({
  tone,
  icon,
  label,
  value,
  currency,
  note,
  trend,
  href,
}: {
  tone: keyof typeof heroTones;
  icon: React.ReactNode;
  label: string;
  value?: number | string;
  currency: string;
  note?: string;
  trend?: { up: boolean; text: string };
  href?: string;
}) {
  const style = heroTones[tone];
  const TrendIcon = trend?.up ? TrendUpIcon : TrendDownIcon;
  const body = (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-white/10" />
      <span className="relative flex items-start justify-between gap-2">
        <span aria-hidden="true" className={`flex size-10 items-center justify-center rounded-xl ${style.chip}`}>{icon}</span>
        {href ? (
          <ArrowRightIcon className="size-4 shrink-0 transition group-hover:translate-x-0.5 motion-reduce:transition-none" />
        ) : null}
      </span>
      <span className={`relative mt-4 block text-sm font-medium ${style.soft}`}>{label}</span>
      <span className="relative mt-1 flex flex-wrap items-baseline gap-x-1.5">
        <span className="font-display text-[clamp(1.375rem,5.4vw,2rem)] leading-tight font-bold tabular-nums">{formatAmount(value)}</span>
        <span className={`text-xs font-semibold ${style.soft}`}>{currency}</span>
      </span>
      {note ? <span className={`relative mt-1 block text-xs ${style.soft}`}>{note}</span> : null}
      {trend ? (
        <span className={`relative mt-3 inline-flex items-center gap-1.5 self-start rounded-full px-2 py-0.5 text-xs font-semibold ${style.pill}`}>
          <TrendIcon className="size-3.5" />
          {trend.text}
        </span>
      ) : null}
    </>
  );
  const box = `relative flex min-w-0 flex-col overflow-hidden rounded-panel p-4 shadow-card sm:p-5 ${style.box}`;
  return href ? (
    <Link className={`${box} group transition hover:-translate-y-0.5 hover:shadow-pop motion-reduce:transition-none ${focusRing}`} href={href}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

/** A secondary figure on white, with its icon in a tinted chip. */
function StatCard({
  icon,
  tint,
  label,
  value,
  currency,
  note,
  href,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
  currency?: string;
  note?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-display text-[clamp(1.25rem,4.6vw,1.625rem)] leading-tight font-bold text-ink tabular-nums">
            {value}
            {currency ? <span className="ml-1.5 font-sans text-xs font-semibold text-slate">{currency}</span> : null}
          </span>
          <span className="mt-1 block text-sm font-medium text-slate">{label}</span>
        </span>
        <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      </span>
      {note ? (
        <span className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-slate">
          <span className="min-w-0">{note}</span>
          {href ? <ArrowRightIcon className="size-4 shrink-0 text-brand-ink transition group-hover:translate-x-0.5 motion-reduce:transition-none" /> : null}
        </span>
      ) : null}
    </>
  );
  const box = "flex min-w-0 flex-col rounded-panel border border-line bg-white p-4 shadow-card sm:p-5";
  if (!href) {
    return <div className={box}>{body}</div>;
  }
  // the low-stock card points further down this page; the others open their own page
  return href.startsWith("#") ? (
    <a className={`${box} group transition hover:border-brand/50 motion-reduce:transition-none ${focusRing}`} href={href}>{body}</a>
  ) : (
    <Link className={`${box} group transition hover:border-brand/50 motion-reduce:transition-none ${focusRing}`} href={href}>{body}</Link>
  );
}
