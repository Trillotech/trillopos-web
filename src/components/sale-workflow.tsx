"use client";
import { useCallback, useEffect, useState } from "react";
import Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { Alert, Button, Checkbox, Field, Panel, SelectField } from "@/components/ui";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { formatAmount } from "@/lib/money";
import { messageFor, readJson } from "@/lib/read-json";
import { useMembershipRole } from "@/lib/role";

const methods = ["CASH", "KBZ_PAY", "WAVE_PAY", "AYA_PAY", "CB_PAY", "BANK_TRANSFER", "OTHER"] as const;
type Method = (typeof methods)[number];
type Action = "progress" | "payments" | "cancel";

export function SaleWorkflow({ sale, onSaved }: { sale: Schemas["SaleView"]; onSaved: (sale: Schemas["SaleView"]) => void }) {
  const t=useTranslations("saleWorkflow"), errors=useTranslations("errors"), codes=useCodes();
  const { managesStock }=useMembershipRole();
  const [action,setAction]=useState<Action>();
  const [reason,setReason]=useState("");
  const [method,setMethod]=useState<Method>("KBZ_PAY");
  const [amount,setAmount]=useState("");
  const [reference,setReference]=useState("");
  // Undefined requires an explicit choice before cancellation.
  const [restock,setRestock]=useState<boolean>();
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string>();
  const [history,setHistory]=useState<Schemas["SaleProgressEventView"][]>([]);
  const [historyError,setHistoryError]=useState<string>();
  const [key,setKey]=useState(()=>crypto.randomUUID());
  const money=sale.paymentState;
  const canceled=sale.progress==="CANCELED";
  const fullReturn=sale.status==="REFUNDED";
  const loadHistory=useCallback(()=>readJson<Schemas["SaleProgressEventView"][]>(`/api/sales/${sale.id}/progress`)
    .then(rows=>{setHistory(rows);setHistoryError(undefined);})
    .catch(caught=>setHistoryError(messageFor(caught,errors,code=>errors.has(code)))),[sale.id,errors]);
  useEffect(()=>{void loadHistory();},[loadHistory,sale.progress]);

  function choose(next: Action) {
    setAction(next);setReason("");setError(undefined);setConfirmed(false);setRestock(undefined);
    setAmount(String(money?.outstandingAmount??""));setKey(crypto.randomUUID());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();setBusy(true);setError(undefined);
    try {
      let cashierShiftId: string|undefined;
      if ((action==="payments" || action==="cancel") && method==="CASH") {
        // no open shift: the cash is recorded without a drawer, as the hint under the method says
        const shift=await readJson<Schemas["ShiftView"]|null>(`/api/sales/shifts?locationId=${sale.locationId}`);
        cashierShiftId=shift?.status==="OPEN"?shift.id:undefined;
      }
      const body=action==="progress"?{progress:sale.progress==="OPEN"?"CLOSED":"OPEN",reason}
        : action==="payments"?{amount,method,locationId:sale.locationId,cashierShiftId,referenceNo:reference||undefined,idempotencyKey:key}
        : {reason,restock,refundMethod:method,cashierShiftId,referenceNo:reference||undefined,idempotencyKey:key,
          expectedNetReceivedAmount:money?.netReceivedAmount,expectedOutstandingAmount:money?.outstandingAmount};
      await readJson(`/api/sales/${sale.id}/${action}`,{method:"POST",body:JSON.stringify(body)});
      onSaved(await readJson<Schemas["SaleView"]>(`/api/sales/${sale.id}`));
      setAction(undefined);setKey(crypto.randomUUID());void loadHistory();
    } catch(caught) {
      setError(messageFor(caught,errors,code=>errors.has(code)));
      setConfirmed(false);
      // Show current figures after a concurrent collection/return, keeping the retry key.
      void readJson<Schemas["SaleView"]>(`/api/sales/${sale.id}`).then(onSaved).catch(()=>{});
    } finally {setBusy(false);}
  }

  if (!money) return null;
  const canPay=!canceled && new Decimal(money.outstandingAmount??0).gt(0);
  const canCancel=managesStock && !canceled && new Decimal(money.writtenOffAmount??0).isZero();
  return <Panel title={t("title")}>
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate">{t("hint")}</p>
      {!canceled?<div className="flex flex-wrap gap-2">
        {!fullReturn?<Button type="button" variant="secondary" disabled={busy} onClick={()=>choose("progress")}>
          {sale.progress==="OPEN"?t("close"):t("reopen")}
        </Button>:null}
        {canPay?<Button type="button" disabled={busy} onClick={()=>choose("payments")}>{t("collect")}</Button>:null}
        {canCancel?<Button type="button" variant="danger" disabled={busy} onClick={()=>choose("cancel")}>{t("cancelSale")}</Button>:null}
      </div>:<Alert tone="info">{t("canceledHint")}</Alert>}
      {new Decimal(money.writtenOffAmount??0).gt(0)?<Alert tone="info">{t("writeOffHint")}</Alert>:null}
      {action?<form className="flex flex-col gap-4 rounded-button border border-line p-4" onSubmit={event=>void submit(event)}>
        <h3 className="font-semibold text-ink">{action==="progress"?(sale.progress==="OPEN"?t("close"):t("reopen")):action==="payments"?t("collect"):t("cancelSale")}</h3>
        {action==="cancel"?<>
          <Alert tone="info">{t("cancelHint")}</Alert>
          <dl className="grid grid-cols-[1fr_auto] gap-2 text-sm" data-testid="cancellation-amounts">
            <dt>{t("refundMoney")}</dt><dd className="text-right font-semibold tabular-nums">{formatAmount(money.netReceivedAmount)}</dd>
            <dt>{t("releaseCredit")}</dt><dd className="text-right font-semibold tabular-nums">{formatAmount(money.outstandingAmount)}</dd>
          </dl>
          <SelectField label={t("restock")} value={restock===undefined?"":String(restock)} required onChange={event=>{setRestock(event.target.value===""?undefined:event.target.value==="true");setConfirmed(false);}}>
            <option value="">{t("chooseRestock")}</option>
            <option value="true">{t("restockYes")}</option><option value="false">{t("restockNo")}</option>
          </SelectField>
        </>:null}
        {action==="payments"?<Field label={t("amount")} inputMode="decimal" required value={amount} onChange={event=>setAmount(event.target.value)} hint={t("due",{amount:formatAmount(money.outstandingAmount)})}/>:null}
        {action==="payments" || (action==="cancel" && new Decimal(money.netReceivedAmount??0).gt(0))?<>
          <SelectField label={action==="payments"?t("paymentMethod"):t("refundMethod")} value={method} onChange={event=>setMethod(event.target.value as Method)}>
            {methods.map(value=><option key={value} value={value}>{codes("method",value)}</option>)}
          </SelectField>
          <Field label={t("reference")} maxLength={100} value={reference} onChange={event=>setReference(event.target.value)} />
          {method==="CASH"?<p className="text-xs text-slate">{t("drawerHint")}</p>:null}
        </>:null}
        {action!=="payments"?<Field label={t("reason")} required maxLength={500} value={reason} onChange={event=>{setReason(event.target.value);setConfirmed(false);}} />:null}
        {action==="cancel"?<Checkbox checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} label={t("confirmCancellation")} />:null}
        {error?<Alert>{error}</Alert>:null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" busy={busy} variant={action==="cancel"?"dangerSolid":"primary"}
            disabled={(action==="cancel" && (!confirmed || restock===undefined || !reason.trim())) || (action==="payments" && (!canPay || !amount.trim()))}>
            {action==="cancel"?t("confirmCancel"):t("save")}
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={()=>setAction(undefined)}>{t("back")}</Button>
        </div>
      </form>:null}
      {historyError?<Alert>{historyError}</Alert>:null}
      {history.length?<details><summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold">{t("history")}</summary>
        <ol className="flex flex-col gap-3 text-sm">{history.map(item=><li key={item.id} className="border-l-2 border-line pl-3">
          <p className="font-semibold">{codes("saleProgress",item.fromProgress)} → {codes("saleProgress",item.toProgress)}</p>
          <p className="break-words">{item.reason}</p><p className="text-xs text-slate">{item.changedAt?new Date(item.changedAt).toLocaleString():""}</p>
        </li>)}</ol>
      </details>:null}
    </div>
  </Panel>;
}
