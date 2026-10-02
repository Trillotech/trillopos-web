"use client";

import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { useTranslations } from "next-intl";

import { PlusIcon, WalletIcon } from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ConfirmButton,
  EmptyState,
  Field,
  Figure,
  insetFocusRing,
  LoadingRows,
  Modal,
  Page,
  PageHeader,
  SelectField,
} from "@/components/ui";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { formatAmount } from "@/lib/money";
import { openShiftId } from "@/lib/open-shift";
import { messageFor, readJson, readResponse } from "@/lib/read-json";
import { useMembershipRole } from "@/lib/role";

type Row = Schemas["ReceivableView"];
type Customer = Schemas["CustomerView"];
type Location = Schemas["LocationView"];
type Method = "CASH" | "KBZ_PAY" | "WAVE_PAY" | "AYA_PAY" | "CB_PAY" | "BANK_TRANSFER" | "OTHER";

const methods: Method[] = ["CASH", "KBZ_PAY", "WAVE_PAY", "AYA_PAY", "CB_PAY", "BANK_TRANSFER", "OTHER"];

/** Open and part-paid debts can still be paid or written off. */
const payable = (row?: Row) => row?.status === "OPEN" || row?.status === "PARTIALLY_SETTLED";

export function statusTone(status?: string) {
  return status === "SETTLED" ? "ok" : status === "PARTIALLY_SETTLED" ? "info" : status === "OPEN" ? "warn" : "muted";
}

export function ReceivableDesk() {
  const t = useTranslations("receivables");
  const errors = useTranslations("errors");
  const codes = useCodes();
  const { owner, locationId: scope } = useMembershipRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [status, setStatus] = useState("open");
  const [overdue, setOverdue] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [selected, setSelected] = useState<Row>();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("CASH");
  const [locationId, setLocationId] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualCustomer, setManualCustomer] = useState("");
  const [manualDue, setManualDue] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<"repay" | "writeOff" | "create">();
  const [key, setKey] = useState(() => crypto.randomUUID());

  function load() {
    const search = new URLSearchParams({ status });
    if (overdue) {
      search.set("overdue", "true");
    }
    if (customerId) {
      search.set("customerId", customerId);
    }
    return readJson<Row[]>(`/api/receivables?${search}`).then(setRows);
  }

  useEffect(() => {
    void readJson<Customer[]>("/api/customers").then(setCustomers);
    void readJson<Location[]>("/api/org/locations").then((all) => {
      const found = scope ? all.filter(row => row.id === scope) : all;
      setLocations(found);
      if (found[0]?.id) {
        setLocationId(found[0].id);
        setManualCustomer("");
      }
    });
  }, [scope]);

  useEffect(() => {
    void load()
      .catch((caught) => setError(messageFor(caught, errors, (code) => errors.has(code))))
      .finally(() => setLoaded(true));
    // Filters are applied together when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, overdue, customerId]);

  function fail(caught: unknown) {
    setFormError(messageFor(caught, errors, (code) => errors.has(code)));
  }

  async function open(id: string) {
    setError(undefined);
    setFormError(undefined);
    setNotice(undefined);
    try {
      setSelected(await readJson<Row>(`/api/receivables/${id}`));
    } catch (caught) {
      setError(messageFor(caught, errors, (code) => errors.has(code)));
    }
  }

  async function repay(event: React.FormEvent) {
    event.preventDefault();
    if (!selected?.id) {
      return;
    }
    setFormError(undefined);
    setNotice(undefined);
    setBusy("repay");
    try {
      const cashierShiftId = method === "CASH" ? await openShiftId(locationId) : undefined;
      const result = await readResponse<Row>(`/api/receivables/${selected.id}/settlements`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          method,
          locationId,
          cashierShiftId,
          referenceNo: reference || undefined,
          note: note || undefined,
          idempotencyKey: key,
        }),
      });
      setNotice(result.replayed ? t("replayed") : t("recorded"));
      setKey(crypto.randomUUID());
      setAmount("");
      setSelected(result.data);
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  async function writeOff() {
    if (!selected?.id) {
      return;
    }
    setFormError(undefined);
    setBusy("writeOff");
    try {
      setSelected(await readJson<Row>(`/api/receivables/${selected.id}/write-off`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || undefined }),
      }));
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    setBusy("create");
    try {
      const created = await readJson<Row>("/api/receivables", {
        method: "POST",
        body: JSON.stringify({
          customerId: manualCustomer,
          locationId,
          amount: manualAmount,
          dueDate: manualDue || undefined,
          note: manualNote || undefined,
        }),
      });
      setManualAmount("");
      setAdding(false);
      setNotice(undefined);
      setSelected(created);
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  const total = rows.reduce((sum, row) => sum.plus(row.outstandingAmount ?? 0), new Decimal(0));
  const overdueCount = rows.filter((row) => row.overdue).length;
  const filtered = status !== "open" || overdue || customerId !== "";

  return (
    <Page>
      <PageHeader
        actions={
          owner ? (
            <Button
              onClick={() => {
                setFormError(undefined);
                setAdding(true);
              }}
              type="button"
              variant="secondary"
            >
              <PlusIcon className="size-5" />
              {t("addDebt")}
            </Button>
          ) : null
        }
        subtitle={t("subtitle")}
        title={t("title")}
      />

      <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-center">
        <SelectField hideLabel label={t("status")} onChange={(event) => setStatus(event.target.value)} value={status}>
          <option value="open">{t("open")}</option>
          <option value="all">{t("all")}</option>
        </SelectField>
        <SelectField hideLabel label={t("customer")} onChange={(event) => setCustomerId(event.target.value)} value={customerId}>
          <option value="">{t("allCustomers")}</option>
          {customers.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </SelectField>
        <Checkbox checked={overdue} label={t("overdueOnly")} onChange={(event) => setOverdue(event.target.checked)} />
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {!loaded ? (
        <LoadingRows rows={4} />
      ) : rows.length === 0 ? (
        error ? null : (
          <EmptyState
            hint={filtered ? t("noMatchHint") : t("emptyHint")}
            icon={<WalletIcon className="size-6" />}
            title={filtered ? t("noMatch") : t("empty")}
          />
        )
      ) : (
        <div className="flex flex-col gap-2">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-slate">
            <span>{t("totalOwed")}</span>
            <span className="text-base font-semibold text-ink tabular-nums">{formatAmount(total.toString())}</span>
            {overdueCount > 0 ? <Badge tone="bad">{t("overdueCount", { count: overdueCount })}</Badge> : null}
          </p>

          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-panel border border-line bg-white shadow-xs lg:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  className={`flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-slate-50 motion-reduce:transition-none ${insetFocusRing}`}
                  onClick={() => void open(row.id!)}
                  type="button"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{row.customerName}</span>
                    <span className="block truncate text-xs text-slate">
                      {[row.referenceNumber, row.dueDate ? `${t("due")} ${row.dueDate}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-2">
                    <span className="font-semibold text-ink tabular-nums">{formatAmount(row.outstandingAmount)}</span>
                    {row.overdue ? <Badge tone="bad">{t("overdue")}</Badge> : <Badge tone={statusTone(row.status)}>{codes("receivableStatus", row.status)}</Badge>}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-panel border border-line bg-white shadow-xs lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs font-semibold text-slate">
                <tr>
                  <th className="px-4 py-4" scope="col">{t("customer")}</th>
                  <th className="px-4 py-4" scope="col">{t("reference")}</th>
                  <th className="px-4 py-4" scope="col">{t("due")}</th>
                  <th className="px-4 py-4 text-right" scope="col">{t("outstanding")}</th>
                  <th className="px-4 py-4" scope="col">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr className="transition-colors hover:bg-slate-50 motion-reduce:transition-none" key={row.id}>
                    <td className="px-4 py-4">
                      <button className={`rounded-sm font-semibold text-ink hover:text-brand-ink hover:underline ${insetFocusRing}`} onClick={() => void open(row.id!)} type="button">
                        {row.customerName}
                      </button>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs whitespace-nowrap text-slate">{row.referenceNumber}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        {row.dueDate ?? "—"}
                        {row.overdue ? <Badge tone="bad">{t("overdue")}</Badge> : null}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold tabular-nums">{formatAmount(row.outstandingAmount)}</td>
                    <td className="px-4 py-4">
                      <Badge tone={statusTone(row.status)}>{codes("receivableStatus", row.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal onClose={() => setSelected(undefined)} open={selected !== undefined} title={selected?.customerName ?? ""} wide>
        {selected ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate">
              <Badge tone={statusTone(selected.status)}>{codes("receivableStatus", selected.status)}</Badge>
              {selected.overdue ? <Badge tone="bad">{t("overdue")}</Badge> : null}
              <span className="font-mono text-xs">{selected.referenceNumber}</span>
              <span>· {codes("receivableSource", selected.sourceType)}</span>
            </div>
            <dl className="divide-y divide-line">
              <Figure label={t("original")} value={formatAmount(selected.originalAmount)} />
              <Figure label={t("paid")} value={formatAmount(selected.settledAmount)} />
              {selected.writtenOffAmount ? <Figure label={t("writtenOff")} value={formatAmount(selected.writtenOffAmount)} /> : null}
              <Figure label={t("outstanding")} strong value={formatAmount(selected.outstandingAmount)} />
              <Figure label={t("due")} value={selected.dueDate ?? "—"} />
              {selected.note ? <Figure label={t("note")} value={selected.note} /> : null}
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">{t("payments")}</h3>
              {selected.settlements?.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {selected.settlements.map((settlement) => (
                    <li className="flex items-start justify-between gap-4 rounded-button bg-surface px-4 py-2" key={settlement.id}>
                      <span className="min-w-0">
                        <span className="block font-medium text-ink">{codes("method", settlement.method)}</span>
                        <span className="block text-xs text-slate">
                          {[settlement.paidAt ? new Date(settlement.paidAt).toLocaleDateString() : null, settlement.referenceNo].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{formatAmount(settlement.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate">{t("noPayments")}</p>
              )}
            </div>

            {notice ? <Alert tone="success">{notice}</Alert> : null}

            {payable(selected) ? (
              <form className="flex flex-col gap-4 border-t border-line pt-6" onSubmit={(event) => void repay(event)}>
                <h3 className="text-sm font-semibold text-ink">{t("repay")}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-end gap-2">
                    <Field className="flex-1" inputMode="decimal" label={t("amount")} onChange={(event) => setAmount(event.target.value)} required value={amount} />
                    <Button onClick={() => setAmount(String(selected.outstandingAmount ?? ""))} type="button" variant="secondary">
                      {t("wholeAmount")}
                    </Button>
                  </div>
                  <SelectField label={t("method")} onChange={(event) => setMethod(event.target.value as Method)} value={method}>
                    {methods.map((value) => (
                      <option key={value} value={value}>{codes("method", value)}</option>
                    ))}
                  </SelectField>
                  {locations.length > 1 ? (
                    <SelectField label={t("location")} onChange={(event) => setLocationId(event.target.value)} value={locationId}>
                      {locations.map((row) => (
                        <option key={row.id} value={row.id}>{row.name}</option>
                      ))}
                    </SelectField>
                  ) : null}
                  <Field label={t("reference")} onChange={(event) => setReference(event.target.value)} value={reference} />
                  <Field className="sm:col-span-2" label={t("note")} onChange={(event) => setNote(event.target.value)} value={note} />
                </div>
                {formError ? <Alert>{formError}</Alert> : null}
                <Button busy={busy === "repay"} className="self-start" disabled={busy !== undefined && busy !== "repay"} type="submit">
                  {t("repay")}
                </Button>
              </form>
            ) : formError ? (
              <Alert>{formError}</Alert>
            ) : null}

            {owner && payable(selected) ? (
              <div className="flex flex-col gap-4 border-t border-line pt-6">
                <h3 className="text-sm font-semibold text-ink">{t("writeOff")}</h3>
                <Field hint={t("writeOffHint")} label={t("reason")} onChange={(event) => setReason(event.target.value)} value={reason} />
                <div>
                  <ConfirmButton
                    busy={busy === "writeOff"}
                    confirmLabel={t("writeOffConfirm")}
                    label={t("writeOff")}
                    onConfirm={() => void writeOff()}
                    question={t("writeOffQuestion", { amount: formatAmount(selected.outstandingAmount), name: selected.customerName ?? "" })}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal onClose={() => setAdding(false)} open={adding} title={t("manual")}>
        <form className="flex flex-col gap-4" onSubmit={(event) => void create(event)}>
          <p className="text-sm text-slate">{t("manualHint")}</p>
          <SelectField label={t("customer")} onChange={(event) => setManualCustomer(event.target.value)} required value={manualCustomer}>
            <option value="">{t("chooseCustomer")}</option>
            {customers.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </SelectField>
          <Field inputMode="decimal" label={t("amount")} onChange={(event) => setManualAmount(event.target.value)} required value={manualAmount} />
          <Field label={t("due")} onChange={(event) => setManualDue(event.target.value)} type="date" value={manualDue} />
          <Field label={t("note")} onChange={(event) => setManualNote(event.target.value)} value={manualNote} />
          {formError ? <Alert>{formError}</Alert> : null}
          <Button busy={busy === "create"} className="self-start" disabled={!manualCustomer || !locationId} type="submit">
            {t("create")}
          </Button>
        </form>
      </Modal>
    </Page>
  );
}
