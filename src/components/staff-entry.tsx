"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, Button, Field, LoadingRows, SelectField, linkClasses } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { readJson, messageFor } from "@/lib/read-json";
import type { Schemas } from "@/lib/backend";
import { landing } from "@/lib/permissions";

async function enter(locale: string) {
  const session = await readJson<{ current?: Schemas["SessionView"] }>("/api/auth/session");
  // New session: discard the previous user's cached console and client state.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a new identity must discard all previous client state
  window.location.assign(`/${locale}${landing(session.current?.role)}`);
}

export function JoinForm({ initialError }: { initialError?: string }) {
  const t = useTranslations("staffAccess");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const [mode, setMode] = useState<"new" | "existing" | "signedIn">("new");
  const [error, setError] = useState(initialError ? (errors.has(initialError) ? errors(initialError) : errors("unknown")) : undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void readJson<{ authenticated: boolean; kind?: string }>("/api/auth/session").then(session => {
      if (session.authenticated && session.kind !== "REGISTER") setMode("signedIn");
    }).catch(() => {});
  }, []);
  return <div className="flex flex-col gap-5">
    <div><h1 className="text-2xl font-bold text-ink">{t("joinTitle")}</h1><p className="mt-2 text-sm text-slate">{t("joinHint")}</p></div>
    <form action={mode === "new" ? "/api/auth/join" : undefined} method="post" className="flex flex-col gap-4" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(undefined);
      const values = Object.fromEntries(new FormData(event.currentTarget));
      try {
        if (mode === "new") await readJson("/api/auth/join", { method: "POST", body: JSON.stringify(values) });
        else {
          if (mode === "existing") await readJson("/api/auth/login", { method: "POST", body: JSON.stringify(values) });
          await readJson("/api/auth/invitations/accept", { method: "POST", body: JSON.stringify({ code: values.code }) });
        }
        await enter(locale);
      } catch (caught) { setError(messageFor(caught, errors, key => errors.has(key))); setBusy(false); }
    }}>
      <input type="hidden" name="locale" value={locale} />
      <Field label={t("inviteCode")} name="code" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={16} required />
      {mode === "new" ? <Field label={t("name")} name="fullName" autoComplete="name" required /> : null}
      {mode !== "signedIn" ? <>
        <Field label={t("phone")} name="phone" autoComplete="tel" type="tel" required />
        <Field label={t("password")} name="password" autoComplete={mode === "new" ? "new-password" : "current-password"} type="password" minLength={mode === "new" ? 8 : undefined} required />
      </> : <p className="text-sm text-slate">{t("signedInHint")}</p>}
      {error ? <Alert>{error}</Alert> : null}
      <Button busy={busy} type="submit">{t("join")}</Button>
    </form>
    {mode !== "signedIn" ? <Button variant="secondary" onClick={() => { setMode(mode === "new" ? "existing" : "new"); setError(undefined); }}>
      {t(mode === "new" ? "existingAccount" : "newAccount")}
    </Button> : null}
    <Link className={linkClasses} href="/login">{t("backToLogin")}</Link>
  </div>;
}

type RegisterState = { configured: boolean; staff: Schemas["StaffEntry"][] };
export function RegisterLogin() {
  const t = useTranslations("staffAccess");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const [state, setState] = useState<RegisterState>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void readJson<RegisterState>("/api/registers/device").then(setState)
      .catch(caught => setError(messageFor(caught, errors, key => errors.has(key))));
  }, [errors]);
  async function forget() {
    setBusy(true);
    try {
      await readJson("/api/registers/device", { method: "DELETE" });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- discard the shared device session and cached console
      window.location.assign(`/${locale}/login`);
    }
    catch (caught) { setError(messageFor(caught, errors, key => errors.has(key))); setBusy(false); }
  }
  return <div className="flex flex-col gap-5">
    <div><h1 className="text-2xl font-bold text-ink">{t("registerTitle")}</h1><p className="mt-2 text-sm text-slate">{t("registerHint")}</p></div>
    {error ? <Alert>{error}</Alert> : null}
    {!state && !error ? <LoadingRows rows={2} /> : null}
    {state?.configured ? state.staff.length ? <form className="flex flex-col gap-4" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(undefined);
      const values = Object.fromEntries(new FormData(event.currentTarget));
      try { await readJson("/api/registers/pin", { method: "POST", body: JSON.stringify(values) }); await enter(locale); }
      catch (caught) { setError(messageFor(caught, errors, key => errors.has(key))); setBusy(false); }
    }}>
      <SelectField label={t("staffName")} name="membershipId" required defaultValue="">
        <option value="" disabled>{t("chooseName")}</option>
        {state.staff.map(member => <option key={member.membershipId} value={member.membershipId}>{member.displayName}</option>)}
      </SelectField>
      <Field label={t("pin")} name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" required />
      <Button busy={busy} type="submit">{t("signIn")}</Button>
    </form> : <p className="text-sm text-slate">{t("noPinStaff")}</p> : state ? <>
      <p className="text-sm text-slate">{t("setupHint")}</p>
      <form className="flex flex-col gap-4" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError(undefined);
        const credential = new FormData(event.currentTarget).get("credential");
        try {
          await readJson("/api/registers/device", { method: "POST", body: JSON.stringify({ credential }) });
          window.location.reload();
        } catch (caught) { setError(messageFor(caught, errors, key => errors.has(key))); setBusy(false); }
      }}>
        <Field label={t("setupCode")} name="credential" type="password" autoComplete="off" required />
        <Button busy={busy} type="submit">{t("setup")}</Button>
      </form>
    </> : null}
    {state?.configured || error ? <Button variant="secondary" disabled={busy} onClick={() => void forget()}>{t("forgetDevice")}</Button> : null}
    <Link className={linkClasses} href="/login">{t("phoneLogin")}</Link>
  </div>;
}
