"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { TrashIcon } from "@/components/icons";
import { Alert, Button, IconButton, Modal } from "@/components/ui";
import type { Schemas } from "@/lib/backend";
import { addQuantities, formatQuantity } from "@/lib/money";
import { messageFor, readJson } from "@/lib/read-json";

/**
 * Delete, after a confirmation. The product leaves the catalog and the sale screen; its sales, stock
 * history and reports keep it. Stock it still holds is written off in the same step (the backend
 * posts a stock-out first), so the stock value never counts goods nobody can see or sell.
 * `compact`: a bin icon for a list row; otherwise a Delete button.
 */
export function DeleteProduct({
  product,
  compact = false,
  onDeleted,
}: {
  product: { id?: string; name?: string };
  compact?: boolean;
  onDeleted: () => void;
}) {
  const t = useTranslations("productDelete");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const name = product.name ?? "";

  function start() {
    setError(undefined);
    setQuantity(undefined);
    setOpen(true);
    void readJson<Schemas["BalanceView"][]>("/api/catalog/balances")
      .then((rows) => setQuantity(addQuantities(rows.filter((row) => row.productId === product.id).map((row) => row.quantity))))
      .catch(() => setQuantity(undefined));
  }

  async function remove() {
    setBusy(true);
    setError(undefined);
    try {
      await readJson(`/api/catalog/products/${product.id}?writeOffStock=true`, { method: "DELETE" });
      setOpen(false);
      onDeleted();
    } catch (caught) {
      setError(messageFor(caught, errors, (code) => errors.has(code)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {compact ? (
        <IconButton label={t("buttonFor", { name })} onClick={start} tone="danger">
          <TrashIcon className="size-5" />
        </IconButton>
      ) : (
        <Button onClick={start} type="button" variant="danger">
          <TrashIcon className="size-5" />
          {t("button")}
        </Button>
      )}
      <Modal onClose={() => setOpen(false)} open={open} title={t("title", { name })}>
        <div className="flex flex-col gap-4 text-left">
          <p className="text-sm text-slate">{t("body")}</p>
          {quantity && Number(quantity) > 0 ? <Alert tone="info">{t("stock", { quantity: formatQuantity(quantity) })}</Alert> : null}
          {error ? <Alert>{error}</Alert> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
              {common("cancel")}
            </Button>
            <Button busy={busy} onClick={() => void remove()} type="button" variant="dangerSolid">
              {t("confirm")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
