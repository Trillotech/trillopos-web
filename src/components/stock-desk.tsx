"use client";

import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { useTranslations } from "next-intl";

import { BoxIcon, PlusIcon } from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  linkClasses,
  LoadingRows,
  Modal,
  Page,
  PageHeader,
  Panel,
  SelectField,
} from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Schemas } from "@/lib/backend";
import { useMembershipRole } from "@/lib/role";
import { useCodes } from "@/lib/codes";
import { formatAmount, formatQuantity } from "@/lib/money";
import { messageFor, readJson } from "@/lib/read-json";

type Doc = Schemas["DocumentSummary"];
type Product = Schemas["ProductView"];
type Location = Schemas["LocationView"];
type Supplier = Schemas["SupplierView"];
type Movement = Schemas["MovementView"];

const types = ["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "TRANSFER", "OPENING"] as const;

const docTone = (status?: string) => (status === "POSTED" ? "ok" : status === "DRAFT" ? "warn" : "muted");

export function StockDesk() {
  const { locationId: scope } = useMembershipRole();
  const t = useTranslations("stock");
  const errors = useTranslations("errors");
  const codes = useCodes();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [type, setType] = useState<(typeof types)[number]>("STOCK_IN");
  const [locationId, setLocationId] = useState("");
  const [otherLocationId, setOtherLocationId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [ledgerProduct, setLedgerProduct] = useState("");
  const [ledgerLocation, setLedgerLocation] = useState("");
  const [movements, setMovements] = useState<Movement[]>();
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [payableId, setPayableId] = useState<string>();
  const [entryOpen, setEntryOpen] = useState(false);
  const [voiding, setVoiding] = useState<Doc>();
  const [busy, setBusy] = useState<"post" | "void" | "draft" | "ledger">();
  // the latest few entries; the rest one tap away
  const [showAll, setShowAll] = useState(false);

  function load() {
    return readJson<Doc[]>("/api/stock/documents").then(setDocs);
  }

  useEffect(() => {
    void readJson<Doc[]>("/api/stock/documents")
      .then(setDocs)
      .catch((caught) => setError(messageFor(caught, errors, (code) => errors.has(code))))
      .finally(() => setDocsLoaded(true));
    void readJson<Product[]>("/api/catalog/products").then((rows) => {
      setProducts(rows);
      if (rows[0]?.id) {
        setProductId(rows[0].id);
        setLedgerProduct(rows[0].id);
      }
    });
    void readJson<Location[]>("/api/org/locations").then((all) => {
      const rows = scope ? all.filter(row => row.id === scope) : all;
      setLocations(rows);
      if (rows[0]?.id) {
        setLocationId(rows[0].id);
        setLedgerLocation(rows[0].id);
      }
    });
    void readJson<Supplier[]>("/api/catalog/suppliers").then(setSuppliers);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- translator identity is not a reload
  }, []);

  function fail(caught: unknown, inDialog = true) {
    const message = messageFor(caught, errors, (code) => errors.has(code));
    if (inDialog) {
      setFormError(message);
    } else {
      setError(message);
    }
  }

  async function postEntry(event: React.FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    setBusy("post");
    try {
      const posted = await readJson<Schemas["DocumentView"]>("/api/stock/documents", {
        method: "POST",
        body: JSON.stringify({
          type,
          locationId,
          counterpartyLocationId: type === "TRANSFER" ? otherLocationId : undefined,
          supplierId: type === "STOCK_IN" ? supplierId || undefined : undefined,
          lines: [{ productId, quantity, unitCost: unitCost || undefined }],
          post: true,
        }),
      });
      setPayableId(posted.payableId);
      setQuantity("");
      setEntryOpen(false);
      setNotice(t("posted"));
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  async function voidDoc() {
    if (!voiding) {
      return;
    }
    setFormError(undefined);
    setBusy("void");
    try {
      await readJson(`/api/stock/documents/${voiding.id}?action=void`, { method: "POST" });
      setVoiding(undefined);
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  async function postDraft(doc: Doc) {
    setError(undefined);
    setBusy("draft");
    try {
      await readJson(`/api/stock/documents/${doc.id}?action=post`, { method: "POST" });
      await load();
    } catch (caught) {
      fail(caught, false);
    } finally {
      setBusy(undefined);
    }
  }

  async function showLedger(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy("ledger");
    try {
      setMovements(await readJson<Movement[]>(`/api/stock/movements?locationId=${ledgerLocation}&productId=${ledgerProduct}`));
    } catch (caught) {
      fail(caught, false);
    } finally {
      setBusy(undefined);
    }
  }

  const place = (id?: string) => locations.find((row) => row.id === id)?.name ?? "—";
  const where = (doc: Doc) => (doc.type === "TRANSFER" ? `${place(doc.locationId)} → ${place(doc.counterpartyLocationId)}` : place(doc.locationId));
  const when = (value?: string) => (value ? new Date(value).toLocaleDateString() : "—");
  const signed = (value?: number) => {
    if (value == null) {
      return "—";
    }
    return new Decimal(value).gt(0) ? `+${formatQuantity(value)}` : formatQuantity(value);
  };

  return (
    <Page>
      <PageHeader
        actions={
          <Button
            onClick={() => {
              setFormError(undefined);
              setEntryOpen(true);
            }}
            type="button"
          >
            <PlusIcon className="size-5" />
            {t("newEntry")}
          </Button>
        }
        subtitle={t("subtitle")}
        title={t("title")}
      />

      {error ? <Alert>{error}</Alert> : null}
      {notice ? (
        <Alert tone="success">
          {notice}
          {payableId ? (
            <>
              {" "}
              {t("payableCreated")}{" "}
              <Link className={linkClasses} href={`/payables?id=${payableId}`}>{t("payable")}</Link>
            </>
          ) : null}
        </Alert>
      ) : null}

      <Panel title={t("recent")}>
        {!docsLoaded ? (
          <LoadingRows className="h-14" rows={3} />
        ) : docs.length === 0 ? (
          <EmptyState hint={t("recentEmptyHint")} icon={<BoxIcon className="size-6" />} title={t("recentEmpty")} />
        ) : (
          <ul className="-mx-4 flex flex-col divide-y divide-line sm:-mx-6">
            {(showAll ? docs : docs.slice(0, 8)).map((doc) => (
              <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-6" key={doc.id}>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{codes("docType", doc.type)}</span>
                    <Badge tone={docTone(doc.status)}>{codes("docStatus", doc.status)}</Badge>
                  </span>
                  <span className="block truncate text-xs text-slate">
                    {[doc.documentNumber, where(doc), when(doc.occurredAt)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {doc.status === "POSTED" ? (
                  <button className="rounded-sm text-sm font-semibold text-danger hover:underline" onClick={() => setVoiding(doc)} type="button">
                    {t("void")}
                  </button>
                ) : null}
                {doc.status === "DRAFT" ? (
                  <Button busy={busy === "draft"} onClick={() => void postDraft(doc)} type="button" variant="secondary">
                    {t("postNow")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {docs.length > 8 && !showAll ? (
          <Button className="mt-4" onClick={() => setShowAll(true)} type="button" variant="secondary">
            {t("showAll", { count: docs.length })}
          </Button>
        ) : null}
      </Panel>

      <Panel title={t("ledger")}>
        <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" onSubmit={(event) => void showLedger(event)}>
          <SelectField label={t("product")} onChange={(event) => setLedgerProduct(event.target.value)} value={ledgerProduct}>
            {products.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </SelectField>
          <SelectField label={t("location")} onChange={(event) => setLedgerLocation(event.target.value)} value={ledgerLocation}>
            {locations.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </SelectField>
          <Button busy={busy === "ledger"} disabled={!ledgerProduct || !ledgerLocation} type="submit" variant="secondary">
            {t("showLedger")}
          </Button>
        </form>
        <p className="mt-2 text-xs text-slate">{t("ledgerHint")}</p>
        {movements === undefined ? null : movements.length === 0 ? (
          <p className="mt-4 text-sm text-slate">{t("noMovements")}</p>
        ) : (
          <div className="-mx-4 mt-4 overflow-x-auto sm:-mx-6">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-line bg-surface text-xs font-semibold text-slate">
                <tr>
                  <th className="px-4 py-2 sm:pl-6" scope="col">{t("date")}</th>
                  <th className="px-4 py-2" scope="col">{t("type")}</th>
                  <th className="px-4 py-2 text-right" scope="col">{t("change")}</th>
                  <th className="px-4 py-2 text-right" scope="col">{t("unitCost")}</th>
                  <th className="px-4 py-2 text-right" scope="col">{t("balance")}</th>
                  <th className="px-4 py-2 sm:pr-6" scope="col">{t("reference")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {movements.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 whitespace-nowrap sm:pl-6">{when(row.movedAt ?? row.createdAt)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{codes("movementType", row.type)}</td>
                    <td className={`px-4 py-2 text-right font-semibold tabular-nums ${new Decimal(row.quantity ?? 0).lt(0) ? "text-danger" : "text-teal"}`}>
                      {signed(row.quantity)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatAmount(row.unitCost)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatQuantity(row.balanceAfter)}</td>
                    <td className="px-4 py-2 font-mono text-xs whitespace-nowrap text-slate sm:pr-6">{row.referenceNumber ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal onClose={() => setEntryOpen(false)} open={entryOpen} title={t("newEntry")} wide>
        <form className="flex flex-col gap-4" onSubmit={(event) => void postEntry(event)}>
          <div className="flex flex-col gap-2">
            <SelectField label={t("type")} onChange={(event) => setType(event.target.value as typeof type)} value={type}>
              {types.map((value) => (
                <option key={value} value={value}>{codes("docType", value)}</option>
              ))}
            </SelectField>
            <p className="text-xs text-slate">{t(`typeHint.${type}`)}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label={type === "TRANSFER" ? t("from") : t("location")} onChange={(event) => setLocationId(event.target.value)} value={locationId}>
              {locations.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </SelectField>
            {type === "TRANSFER" ? (
              <SelectField label={t("destination")} onChange={(event) => setOtherLocationId(event.target.value)} value={otherLocationId}>
                <option value="">{t("choose")}</option>
                {locations.filter((row) => row.id !== locationId).map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </SelectField>
            ) : null}
            {type === "STOCK_IN" ? (
              <SelectField label={t("supplier")} onChange={(event) => setSupplierId(event.target.value)} value={supplierId}>
                <option value="">{t("none")}</option>
                {suppliers.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </SelectField>
            ) : null}
            <SelectField className="sm:col-span-2" label={t("product")} onChange={(event) => setProductId(event.target.value)} value={productId}>
              {products.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </SelectField>
            <Field inputMode="decimal" label={t("quantity")} onChange={(event) => setQuantity(event.target.value)} required value={quantity} />
            <Field hint={t("unitCostHint")} inputMode="decimal" label={t("unitCost")} onChange={(event) => setUnitCost(event.target.value)} value={unitCost} />
          </div>
          {formError ? <Alert>{formError}</Alert> : null}
          <Button busy={busy === "post"} className="self-start" disabled={!quantity || !locationId || !productId} type="submit">
            {t("postNow")}
          </Button>
        </form>
      </Modal>

      <Modal onClose={() => setVoiding(undefined)} open={voiding !== undefined} title={t("voidTitle")}>
        {voiding ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink">{t("voidQuestion", { number: voiding.documentNumber ?? "" })}</p>
            {formError ? <Alert>{formError}</Alert> : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setVoiding(undefined)} type="button" variant="secondary">{t("keep")}</Button>
              <Button busy={busy === "void"} onClick={() => void voidDoc()} type="button" variant="dangerSolid">
                {t("voidConfirm")}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}
