"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { PlusIcon } from "@/components/icons";
import { Alert, Badge, Button, Field, LoadingRows, Modal, Page, PageHeader, SelectField } from "@/components/ui";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { messageFor, readJson } from "@/lib/read-json";

type Member = Schemas["MembershipView"];
type Location = Schemas["LocationView"];

const roles = ["CASHIER", "STOCK_MANAGER", "PACKER", "OWNER"] as const;

const statusTone = (status?: string) => (status === "ACTIVE" ? "ok" : status === "INVITED" ? "info" : "muted");

export function StaffManager() {
  const t = useTranslations("staff");
  const errors = useTranslations("errors");
  const codes = useCodes();
  const [rows, setRows] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Schemas["InviteRequest"]["role"]>("CASHIER");
  const [locationId, setLocationId] = useState("");
  const [pinCreated, setPinCreated] = useState(false);
  const [pin, setPin] = useState("");
  const [code, setCode] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pinFor, setPinFor] = useState<Member>();
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState<"add" | "pin">();
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  function load() {
    return readJson<Member[]>("/api/org/memberships").then(setRows);
  }

  useEffect(() => {
    void readJson<Member[]>("/api/org/memberships")
      .then(setRows)
      .catch((caught) => setError(messageFor(caught, errors, (key) => errors.has(key))))
      .finally(() => setLoaded(true));
    void readJson<Location[]>("/api/org/locations").then(setLocations);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- translator identity is not a reload
  }, []);

  function fail(caught: unknown) {
    const name = caught instanceof Error ? caught.message : "unknown";
    setFormError(errors.has(name) ? errors(name) : errors("unknown"));
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    setBusy("add");
    try {
      const created = await readJson<Schemas["InviteResponse"]>("/api/org/memberships", {
        method: "POST",
        body: JSON.stringify({ displayName, role, pin: pin || undefined, locationId: locationId || undefined }),
      });
      setCode(created.inviteCode);
      setPinCreated(Boolean(pin));
      setCopied(false);
      setDisplayName("");
      setPin("");
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  async function savePin(event: React.FormEvent) {
    event.preventDefault();
    if (!pinFor) {
      return;
    }
    setFormError(undefined);
    setBusy("pin");
    try {
      await readJson(`/api/org/memberships/${pinFor.id}/pin`, { method: "PUT", body: JSON.stringify({ pin: newPin }) });
      setNotice(t("pinSaved", { name: pinFor.displayName ?? "" }));
      setPinFor(undefined);
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  const place = (id?: string) => locations.find((location) => location.id === id)?.name;

  return (
    <Page>
      <PageHeader
        actions={
          <Button
            onClick={() => {
              setFormError(undefined);
              setCode(undefined);
              setPinCreated(false);
              setAdding(true);
            }}
            type="button"
          >
            <PlusIcon className="size-5" />
            {t("invite")}
          </Button>
        }
        subtitle={t("subtitle")}
        title={t("title")}
      />
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {!loaded ? (
        <LoadingRows rows={3} />
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-panel border border-line bg-white shadow-xs">
          {rows.map((row) => (
            <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4" key={row.id}>
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700"
              >
                {Array.from((row.displayName ?? "?").trim())[0]?.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{row.displayName}</span>
                  <Badge tone={statusTone(row.status)}>{codes("memberStatus", row.status)}</Badge>
                </span>
                <span className="block text-xs text-slate">
                  {[codes("role", row.role), place(row.locationId)].filter(Boolean).join(" · ")}
                </span>
              </span>
              {row.status !== "REMOVED" ? (
                <Button
                  onClick={() => {
                    setFormError(undefined);
                    setNewPin("");
                    setPinFor(row);
                  }}
                  type="button"
                  variant="secondary"
                >
                  {t("setPin")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Modal onClose={() => setAdding(false)} open={adding} title={t("invite")}>
        {code || pinCreated ? (
          <div className="flex flex-col gap-4">
            <Alert tone="success">{t(pinCreated ? "pinAdded" : "added")}</Alert>
            {code ? <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-ink">{t("code")}</p>
              <p className="rounded-button border border-line bg-surface px-4 py-2 font-mono text-base tracking-wide">{code}</p>
            </div> : null}
            <div className="flex flex-wrap gap-2">
              {code ? <Button
                onClick={() => {
                  void navigator.clipboard?.writeText(code).then(() => setCopied(true));
                }}
                type="button"
                variant="secondary"
              >
                {copied ? t("copied") : t("copy")}
              </Button> : null}
              <Button onClick={() => setAdding(false)} type="button">{t("done")}</Button>
            </div>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={(event) => void add(event)}>
            <Field label={t("name")} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
            <SelectField label={t("role")} onChange={(event) => setRole(event.target.value as typeof role)} value={role}>
              {roles.map((value) => (
                <option key={value} value={value}>{codes("role", value)}</option>
              ))}
            </SelectField>
            <p className="text-xs text-slate">{t(`roleHint.${role}`)}</p>
            <SelectField label={t("location")} value={locationId} onChange={event => setLocationId(event.target.value)}>
              <option value="">{t("allLocations")}</option>
              {locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
            </SelectField>
            <Field hint={t("pinHint")} inputMode="numeric" label={t("pin")} maxLength={6} onChange={(event) => setPin(event.target.value)} value={pin} />
            {formError ? <Alert>{formError}</Alert> : null}
            <Button busy={busy === "add"} className="self-start" disabled={!displayName} type="submit">
              {t("add")}
            </Button>
          </form>
        )}
      </Modal>

      <Modal onClose={() => setPinFor(undefined)} open={pinFor !== undefined} title={t("setPinFor", { name: pinFor?.displayName ?? "" })}>
        <form className="flex flex-col gap-4" onSubmit={(event) => void savePin(event)}>
          <Field
            hint={t("newPinHint")}
            inputMode="numeric"
            label={t("newPin")}
            maxLength={6}
            onChange={(event) => setNewPin(event.target.value)}
            pattern={"\\d{6}"}
            required
            value={newPin}
          />
          {formError ? <Alert>{formError}</Alert> : null}
          <Button busy={busy === "pin"} className="self-start" type="submit">{t("savePin")}</Button>
        </form>
      </Modal>
    </Page>
  );
}
