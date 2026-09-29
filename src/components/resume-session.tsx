"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Alert, Button, Page, PageLoading } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";

const LAST_TRY = "trillopos-resume";

/**
 * What the console shows while an expired session is renewed: the renewal runs in a route handler,
 * then the same page reloads, so the person lands where they were going. A session that is really
 * over goes to sign-in; a renewal that did not help a moment ago is not repeated in a loop.
 */
export function ResumeSession() {
  const router = useRouter();
  const errors = useTranslations("errors");
  const common = useTranslations("common");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let recent = false;
    try {
      recent = Date.now() - Number(sessionStorage.getItem(LAST_TRY) ?? 0) < 10_000;
      sessionStorage.setItem(LAST_TRY, String(Date.now()));
    } catch {
      // storage can be blocked; then there is no loop guard, only the renewal
    }
    if (recent) {
      void fetch("/api/registers/device").then(r => r.json()).then(body => router.replace(body.configured ? "/register" : "/login")).catch(() => router.replace("/login"));
      return;
    }
    void fetch("/api/auth/resume", { method: "POST" })
      .then((response) => {
        if (response.status === 204) {
          window.location.reload();
        } else if (response.status === 401) {
          void fetch("/api/registers/device").then(r => r.json()).then(body => router.replace(body.configured ? "/register" : "/login")).catch(() => router.replace("/login"));
        } else {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
  }, [router]);

  if (failed) {
    return (
      <Page width="narrow">
        <Alert>{errors("network")}</Alert>
        <Button className="self-start" onClick={() => window.location.reload()} type="button">
          {common("retry")}
        </Button>
      </Page>
    );
  }
  return <PageLoading />;
}
