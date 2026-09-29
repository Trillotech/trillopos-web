"use client";

import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { useTranslations } from "next-intl";

import { PlusIcon, ReceiptIcon } from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  LoadingRows,
  Modal,
  Page,
  PageHeader,
  Panel,
  SelectField,
} from "@/components/ui";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { formatAmount } from "@/lib/money";
import { openShiftId } from "@/lib/open-shift";
import { messageFor, readJson } from "@/lib/read-json";
import { useMembershipRole } from "@/lib/role";

type Expense = Schemas["ExpenseView"];
type Category = Schemas["CategoryView"];
type Location = Schemas["LocationView"];
type Method = Schemas["ExpenseWrite"]["method"];

const methods: Method[] = ["CASH", "KBZ_PAY", "WAVE_PAY", "AYA_PAY", "CB_PAY", "BANK_TRANSFER", "OTHER"];

export function ExpenseDesk() {
  const t = useTranslations("expenses");
  const errors = useTranslations("errors");
  const codes = useCodes();
  const { owner, managesStock, locationId: scope } = useMembershipRole();
  const [rows, setRows] = useState<Expense[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("CASH");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [recording, setRecording] = useState(false);
  const [managing, setManaging] = useState(false);
  const [voiding, setVoiding] = useState<Expense>();
  const [busy, setBusy] = useState<"record" | "category" | "void" | "filter" | "archive">();

  function loadCategories() {
    return readJson<Category[]>("/api/expenses/categories").then((found) => {
      setCategories(found);
      if (!categoryId && found[0]?.id) {
        setCategoryId(found[0].id);
      }
    });
  }

  function loadExpenses() {
    const search = new URLSearchParams();
    if (locationId) {
      search.set("locationId", locationId);
    }
    if (from) {
      search.set("from", from);
    }
    if (to) {
      search.set("to", to);
    }
    return readJson<Expense[]>(`/api/expenses${search.size ? `?${search}` : ""}`).then(setRows);
  }

  useEffect(() => {
    void loadCategories();
    void readJson<Location[]>("/api/org/locations").then((all) => {
      const found = scope ? all.filter(row => row.id === scope) : all;
      setLocations(found);
      if (found[0]?.id) {
        setLocationId(found[0].id);
      }
    });
    void loadExpenses()
      .catch((caught) => setError(messageFor(caught, errors, (code) => errors.has(code))))
      .finally(() => setLoaded(true));
    // First paint uses the backend's default month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fail(caught: unknown) {
    setFormError(messageFor(caught, errors, (code) => errors.has(code)));
  }

  function openDialog(which: "record" | "categories") {
    setFormError(undefined);
    if (which === "record") {
      setRecording(true);
    } else {
      setManaging(true);
    }
  }

  async function record(event: React.FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    setBusy("record");
    try {
      const cashierShiftId = method === "CASH" ? await openShiftId(locationId) : undefined;
      await readJson("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          locationId,
          cashierShiftId,
          amount,
          method,
          description: description || undefined,
          referenceNo: reference || undefined,
        }),
      });
      setAmount("");
      setDescription("");
      setRecording(false);
      setNotice(t("recorded"));
      await loadExpenses();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    setBusy("category");
    try {
      await readJson("/api/expenses/categories", { method: "POST", body: JSON.stringify({ name: categoryName }) });
      setCategoryName("");
      await loadCategories();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  async function archiveCategory(id?: string) {
    setFormError(undefined);
    setBusy("archive");
    try {
      await readJson(`/api/expenses/categories/${id}/archive`, { method: "POST" });
      await loadCategories();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  async function voidExpense() {
    if (!voiding) {
      return;
    }
    setFormError(undefined);
    setBusy("void");
    try {
      await readJson(`/api/expenses/${voiding.id}/void`, { method: "POST" });
      setVoiding(undefined);
      await loadExpenses();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  const total = rows.filter((row) => !row.voidedAt).reduce((sum, row) => sum.plus(row.amount ?? 0), new Decimal(0));
  const when = (row: Expense) => (row.paidAt ? new Date(row.paidAt).toLocaleDateString() : "—");

  return (
    <Page>
      <PageHeader
        actions={
          <>
            {managesStock ? (
              <Button onClick={() => openDialog("categories")} type="button" variant="secondary">
                {t("categories")}
              </Button>
            ) : null}
            <Button onClick={() => openDialog("record")} type="button">
              <PlusIcon className="size-5" />
              {t("record")}
            </Button>
          </>
        }
        subtitle={t("subtitle")}
        title={t("title")}
      />

      <Panel>
        <form
          className="grid grid-cols-2 gap-4 lg:grid-cols-[repeat(2,minmax(0,12rem))_auto] lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy("filter");
            void loadExpenses()
              .catch((caught) => setError(messageFor(caught, errors, (code) => errors.has(code))))
              .finally(() => setBusy(undefined));
          }}
        >
          <Field label={t("from")} onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
          <Field label={t("to")} onChange={(event) => setTo(event.target.value)} type="date" value={to} />
          <Button busy={busy === "filter"} className="col-span-2 lg:col-span-1 lg:justify-self-start" type="submit" variant="secondary">
            {t("apply")}
          </Button>
        </form>
        <p className="mt-2 text-xs text-slate">{t("monthNote")}</p>
      </Panel>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {!loaded ? (
        <LoadingRows rows={4} />
      ) : rows.length === 0 ? (
        error ? null : (
          <EmptyState
            action={
              <Button onClick={() => openDialog("record")} type="button" variant="secondary">
                <PlusIcon className="size-5" />
                {t("record")}
              </Button>
            }
            hint={t("emptyHint")}
            icon={<ReceiptIcon className="size-6" />}
            title={t("empty")}
          />
        )
      ) : (
        <div className="flex flex-col gap-2">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-slate">
            <span>{t("total")}</span>
            <span className="text-base font-semibold text-ink tabular-nums">{formatAmount(total.toString())}</span>
          </p>

          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-panel border border-line bg-white shadow-xs lg:hidden">
            {rows.map((row) => (
              <li className="flex items-start gap-4 px-4 py-4" key={row.id}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{row.categoryName}</span>
                  <span className="block truncate text-xs text-slate">
                    {[when(row), codes("method", row.method), row.description].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2">
                  <span className={`font-semibold tabular-nums ${row.voidedAt ? "text-slate line-through" : "text-ink"}`}>{formatAmount(row.amount)}</span>
                  {row.voidedAt ? (
                    <Badge tone="muted">{t("voided")}</Badge>
                  ) : managesStock ? (
                    <button className="rounded-sm text-sm font-semibold text-danger hover:underline" onClick={() => setVoiding(row)} type="button">
                      {t("void")}
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-panel border border-line bg-white shadow-xs lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs font-semibold text-slate">
                <tr>
                  <th className="px-4 py-4" scope="col">{t("date")}</th>
                  <th className="px-4 py-4" scope="col">{t("category")}</th>
                  <th className="px-4 py-4" scope="col">{t("description")}</th>
                  <th className="px-4 py-4" scope="col">{t("method")}</th>
                  <th className="px-4 py-4 text-right" scope="col">{t("amount")}</th>
                  <th className="px-4 py-4" scope="col"><span className="sr-only">{t("void")}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr className={row.voidedAt ? "text-slate" : ""} key={row.id}>
                    <td className="px-4 py-4 whitespace-nowrap">{when(row)}</td>
                    <td className="px-4 py-4 font-medium">{row.categoryName}</td>
                    <td className="px-4 py-4">
                      {row.description ?? "—"}
                      {row.referenceNo ? <span className="block text-xs text-slate">{row.referenceNo}</span> : null}
                    </td>
                    <td className="px-4 py-4">{codes("method", row.method)}</td>
                    <td className={`px-4 py-4 text-right font-semibold tabular-nums ${row.voidedAt ? "line-through" : ""}`}>{formatAmount(row.amount)}</td>
                    <td className="px-4 py-4 text-right">
                      {row.voidedAt ? (
                        <Badge tone="muted">{t("voided")}</Badge>
                      ) : managesStock ? (
                        <button className="rounded-sm font-semibold text-danger hover:underline" onClick={() => setVoiding(row)} type="button">
                          {t("void")}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal onClose={() => setRecording(false)} open={recording} title={t("record")}>
        {categories.length === 0 ? (
          <div className="flex flex-col items-start gap-4">
            <p className="text-sm text-slate">{t("noCategories")}</p>
            {managesStock ? (
              <Button
                onClick={() => {
                  setRecording(false);
                  openDialog("categories");
                }}
                type="button"
                variant="secondary"
              >
                {t("categories")}
              </Button>
            ) : null}
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={(event) => void record(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label={t("category")} onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </SelectField>
              <Field inputMode="decimal" label={t("amount")} onChange={(event) => setAmount(event.target.value)} required value={amount} />
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
              <Field label={t("description")} onChange={(event) => setDescription(event.target.value)} value={description} />
              <Field label={t("reference")} onChange={(event) => setReference(event.target.value)} value={reference} />
            </div>
            {formError ? <Alert>{formError}</Alert> : null}
            <Button busy={busy === "record"} className="self-start" disabled={!categoryId || !locationId} type="submit">
              {t("record")}
            </Button>
          </form>
        )}
      </Modal>

      <Modal onClose={() => setManaging(false)} open={managing} title={t("categories")}>
        <div className="flex flex-col gap-6">
          <form className="flex items-end gap-2" onSubmit={(event) => void addCategory(event)}>
            <Field className="flex-1" label={t("newCategory")} onChange={(event) => setCategoryName(event.target.value)} required value={categoryName} />
            <Button busy={busy === "category"} type="submit">{t("addCategory")}</Button>
          </form>
          {formError ? <Alert>{formError}</Alert> : null}
          {categories.length === 0 ? (
            <p className="text-sm text-slate">{t("noCategoriesYet")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {categories.map((category) => (
                <li className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2" key={category.id}>
                  <span className="font-medium text-ink">{category.name}</span>
                  {owner ? (
                    <div className="ml-auto">
                      <ConfirmButton
                        busy={busy === "archive"}
                        confirmLabel={t("archiveConfirm")}
                        label={t("archive")}
                        onConfirm={() => void archiveCategory(category.id)}
                        question={t("archiveQuestion", { name: category.name ?? "" })}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <Modal onClose={() => setVoiding(undefined)} open={voiding !== undefined} title={t("voidTitle")}>
        {voiding ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink">
              {t("voidQuestion", { amount: formatAmount(voiding.amount), category: voiding.categoryName ?? "" })}
            </p>
            {formError ? <Alert>{formError}</Alert> : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setVoiding(undefined)} type="button" variant="secondary">{t("keep")}</Button>
              <Button busy={busy === "void"} onClick={() => void voidExpense()} type="button" variant="dangerSolid">
                {t("voidConfirm")}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}
