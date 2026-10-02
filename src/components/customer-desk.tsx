"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { PlusIcon, UsersIcon } from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  insetFocusRing,
  LoadingRows,
  Modal,
  Page,
  PageHeader,
  SearchField,
  SelectField,
} from "@/components/ui";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { formatAmount } from "@/lib/money";
import { messageFor, readJson } from "@/lib/read-json";
import { useMembershipRole } from "@/lib/role";

type Customer = Schemas["CustomerView"];

const empty = {
  name: "",
  phone: "",
  type: "MEMBER" as "MEMBER" | "B2B",
  defaultPriceType: "RETAIL" as "RETAIL" | "WHOLESALE",
  creditLimit: "",
  creditTermDays: "",
  address: "",
  note: "",
};

export function CustomerDesk() {
  const t = useTranslations("customers");
  const errors = useTranslations("errors");
  const codes = useCodes();
  const { owner, managesStock } = useMembershipRole();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<"save" | "archive" | "search">();

  function load(q = query) {
    const search = new URLSearchParams();
    if (q.trim()) {
      search.set("q", q.trim());
    }
    return readJson<Customer[]>(`/api/customers${search.size ? `?${search}` : ""}`).then((found) => {
      setRows(found);
      setSearched(q.trim());
    });
  }

  useEffect(() => {
    void load("")
      .catch((caught) => setError(messageFor(caught, errors, (code) => errors.has(code))))
      .finally(() => setLoaded(true));
    // The first list is the unfiltered register search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startNew() {
    setEditing(undefined);
    setForm(empty);
    setFormError(undefined);
    setFormOpen(true);
  }

  function fill(customer: Customer) {
    setEditing(customer.id);
    setForm({
      name: customer.name ?? "",
      phone: customer.phone ?? "",
      type: customer.type ?? "MEMBER",
      defaultPriceType: customer.defaultPriceType ?? "RETAIL",
      creditLimit: customer.creditLimit == null ? "" : String(customer.creditLimit),
      creditTermDays: customer.creditTermDays == null ? "" : String(customer.creditTermDays),
      address: customer.address ?? "",
      note: customer.note ?? "",
    });
    setFormError(undefined);
    setFormOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    const body: Schemas["CustomerWrite"] = {
      name: form.name,
      phone: form.phone,
      type: form.type,
      defaultPriceType: form.defaultPriceType,
      address: form.address,
      note: form.note,
    };
    if (owner) {
      if (form.creditLimit) {
        body.creditLimit = form.creditLimit as unknown as number;
      }
      if (form.creditTermDays) {
        body.creditTermDays = Number(form.creditTermDays);
      }
    }
    setBusy("save");
    try {
      if (editing) {
        await readJson(`/api/customers/${editing}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await readJson("/api/customers", { method: "POST", body: JSON.stringify(body) });
      }
      setEditing(undefined);
      setForm(empty);
      setFormOpen(false);
      setNotice(t("saved"));
      await load();
    } catch (caught) {
      setFormError(messageFor(caught, errors, (key) => errors.has(key)));
    } finally {
      setBusy(undefined);
    }
  }

  async function archive() {
    if (!editing) {
      return;
    }
    setFormError(undefined);
    setBusy("archive");
    try {
      await readJson(`/api/customers/${editing}/archive`, { method: "POST" });
      setEditing(undefined);
      setFormOpen(false);
      await load();
    } catch (caught) {
      setFormError(messageFor(caught, errors, (key) => errors.has(key)));
    } finally {
      setBusy(undefined);
    }
  }

  const current = rows.find((row) => row.id === editing);
  const set = (patch: Partial<typeof empty>) => setForm({ ...form, ...patch });

  return (
    <Page>
      <PageHeader
        actions={
          <Button onClick={startNew} type="button">
            <PlusIcon className="size-5" />
            {t("create")}
          </Button>
        }
        subtitle={t("subtitle")}
        title={t("title")}
      />

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy("search");
          void load()
            .catch((caught) => setError(messageFor(caught, errors, (code) => errors.has(code))))
            .finally(() => setBusy(undefined));
        }}
      >
        <SearchField className="flex-1" label={t("search")} onChange={(event) => setQuery(event.target.value)} value={query} />
        <Button type="submit" variant="secondary">{t("searchAction")}</Button>
      </form>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {!loaded || busy === "search" ? (
        <LoadingRows rows={4} />
      ) : rows.length === 0 ? (
        error ? null : searched ? (
          <EmptyState hint={t("noMatchHint")} title={t("noMatch")} />
        ) : (
          <EmptyState
            action={
              <Button onClick={startNew} type="button" variant="secondary">
                <PlusIcon className="size-5" />
                {t("create")}
              </Button>
            }
            hint={t("emptyHint")}
            icon={<UsersIcon className="size-6" />}
            title={t("empty")}
          />
        )
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-panel border border-line bg-white shadow-xs lg:hidden">
            {rows.map((customer) => (
              <li key={customer.id}>
                <button
                  className={`flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-slate-50 motion-reduce:transition-none ${insetFocusRing}`}
                  onClick={() => fill(customer)}
                  type="button"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{customer.name}</span>
                    <span className="block truncate text-xs text-slate">
                      {[customer.phone, codes("customerType", customer.type)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-sm font-semibold text-ink tabular-nums">{formatAmount(customer.outstanding)}</span>
                    {customer.archived ? <Badge tone="muted">{t("archived")}</Badge> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-panel border border-line bg-white shadow-xs lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs font-semibold text-slate">
                <tr>
                  <th className="px-4 py-4" scope="col">{t("name")}</th>
                  <th className="px-4 py-4" scope="col">{t("phone")}</th>
                  <th className="px-4 py-4" scope="col">{t("type")}</th>
                  <th className="px-4 py-4 text-right" scope="col">{t("outstanding")}</th>
                  <th className="px-4 py-4 text-right" scope="col">{t("available")}</th>
                  <th className="px-4 py-4" scope="col">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((customer) => (
                  <tr className="transition-colors hover:bg-slate-50 motion-reduce:transition-none" key={customer.id}>
                    <td className="px-4 py-4">
                      <button className={`rounded-sm font-semibold text-ink hover:text-brand-ink hover:underline ${insetFocusRing}`} onClick={() => fill(customer)} type="button">
                        {customer.name}
                      </button>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate tabular-nums">{customer.phone ?? "—"}</td>
                    <td className="px-4 py-4">{codes("customerType", customer.type)}</td>
                    <td className="px-4 py-4 text-right font-semibold tabular-nums">{formatAmount(customer.outstanding)}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{formatAmount(customer.availableCredit)}</td>
                    <td className="px-4 py-4">
                      {customer.archived ? <Badge tone="muted">{t("archived")}</Badge> : <Badge tone="ok">{t("active")}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal onClose={() => setFormOpen(false)} open={formOpen} title={editing ? t("editTitle") : t("create")} wide>
        <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("name")} onChange={(event) => set({ name: event.target.value })} required value={form.name} />
            <Field label={t("phone")} onChange={(event) => set({ phone: event.target.value })} type="tel" value={form.phone} />
            <SelectField label={t("type")} onChange={(event) => set({ type: event.target.value as typeof form.type })} value={form.type}>
              <option value="MEMBER">{codes("customerType", "MEMBER")}</option>
              <option value="B2B">{codes("customerType", "B2B")}</option>
            </SelectField>
            <SelectField
              label={t("priceType")}
              onChange={(event) => set({ defaultPriceType: event.target.value as typeof form.defaultPriceType })}
              value={form.defaultPriceType}
            >
              <option value="RETAIL">{codes("priceType", "RETAIL")}</option>
              <option value="WHOLESALE">{codes("priceType", "WHOLESALE")}</option>
            </SelectField>
            {owner ? (
              <>
                <Field inputMode="decimal" label={t("creditLimit")} onChange={(event) => set({ creditLimit: event.target.value })} value={form.creditLimit} />
                <Field inputMode="numeric" label={t("creditTerm")} onChange={(event) => set({ creditTermDays: event.target.value })} value={form.creditTermDays} />
              </>
            ) : null}
            <Field className="sm:col-span-2" label={t("address")} onChange={(event) => set({ address: event.target.value })} value={form.address} />
            <Field className="sm:col-span-2" label={t("note")} onChange={(event) => set({ note: event.target.value })} value={form.note} />
          </div>
          {!owner ? <p className="text-xs text-slate">{t("creditOwnerHint")}</p> : null}
          {formError ? <Alert>{formError}</Alert> : null}
          <div className="flex flex-wrap gap-2">
            <Button busy={busy === "save"} disabled={busy === "archive"} type="submit">
              {editing ? t("save") : t("create")}
            </Button>
            <Button onClick={() => setFormOpen(false)} type="button" variant="secondary">
              {t("cancel")}
            </Button>
          </div>
        </form>
        {editing && managesStock && current && !current.archived ? (
          <div className="mt-6 border-t border-line pt-6">
            <ConfirmButton
              busy={busy === "archive"}
              confirmLabel={t("archiveConfirm")}
              label={t("archive")}
              onConfirm={() => void archive()}
              question={t("archiveQuestion", { name: current.name ?? "" })}
            />
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}
