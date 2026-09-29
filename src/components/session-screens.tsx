"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Alert, Button, buttonClasses, LoadingRows, SignOut } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import type { Membership } from "@/lib/backend";

type Session =
  | { authenticated: false; memberships: Membership[] }
  | { authenticated: true; kind?: string; memberships: Membership[] };

const quietSignOut = buttonClasses("ghost", "self-center");

export function BusinessPicker() {
  const t = useTranslations("picker");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [session, setSession] = useState<Session>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  // state changes only once the answer is in, never synchronously inside the effect
  const load = useCallback(
    () =>
      fetch("/api/auth/session")
        .then((response) => response.json() as Promise<Session>)
        .then((body) => {
          if (!body.authenticated) {
            router.replace("/login");
            return;
          }
          setSession(body);
        }),
    [router],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function enter(organizationId: string | undefined) {
    if (!organizationId) {
      return;
    }
    setBusy(organizationId);
    setError(undefined);
    const response = await fetch("/api/auth/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { code?: string };
      const code = body.code ?? "unknown";
      setError(errors.has(code) ? errors(code) : errors("unknown"));
      setBusy(undefined);
      return;
    }
    router.replace("/products");
  }

  async function accept(membershipId: string | undefined) {
    if (!membershipId) {
      return;
    }
    setBusy(membershipId);
    setError(undefined);
    const response = await fetch(`/api/auth/invitations/${membershipId}/accept`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json()) as { code?: string };
      const code = body.code ?? "unknown";
      setError(errors.has(code) ? errors(code) : errors("unknown"));
      setBusy(undefined);
      return;
    }
    await load();
    setBusy(undefined);
  }

  const rows = session?.memberships ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{t("title")}</h1>
      {!session ? (
        <LoadingRows className="h-20" rows={2} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              className="flex flex-col gap-4 rounded-panel border border-line p-4 sm:flex-row sm:items-center sm:justify-between"
              key={row.membershipId}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{row.organizationName}</p>
                <p className="text-sm text-slate">
                  {row.displayName}
                  {row.status === "INVITED" ? ` · ${t("invited")}` : null}
                </p>
              </div>
              {row.status === "INVITED" ? (
                <Button busy={busy === row.membershipId} onClick={() => accept(row.membershipId)} type="button" variant="secondary">
                  {busy === row.membershipId ? t("accepting") : t("accept")}
                </Button>
              ) : (
                <Button
                  busy={busy === row.organizationId}
                  disabled={row.status !== "ACTIVE"}
                  onClick={() => enter(row.organizationId)}
                  type="button"
                >
                  {busy === row.organizationId ? t("entering") : t("enter")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error ? <Alert>{error}</Alert> : null}
      <Link className={buttonClasses("secondary")} href="/join">{t("joinCode")}</Link>
      <SignOut className={quietSignOut} label={t("logout")} />
    </div>
  );
}

export function SignedInHome() {
  const t = useTranslations("home");
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/auth/session");
      const body = (await response.json()) as Session;
      if (!body.authenticated) {
        router.replace("/login");
        return;
      }
      if (body.kind === "PICKER") {
        router.replace("/businesses");
        return;
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return <LoadingRows className="h-12" rows={3} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t("title")}</h1>
        <p className="text-sm text-slate">{t("next")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button className="w-full" onClick={() => router.push("/products")} type="button">
          {t("products")}
        </Button>
        <Button className="w-full" onClick={() => router.push("/businesses")} type="button" variant="secondary">
          {t("businesses")}
        </Button>
      </div>
      <SignOut className={quietSignOut} label={t("logout")} pendingLabel={t("signingOut")} />
    </div>
  );
}
