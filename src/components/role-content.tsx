"use client";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Alert, ButtonLink, Page, PageHeader } from "@/components/ui";
import { canOpen, landing, managesStock, type CurrentSession } from "@/lib/permissions";

export function RoleContent({ session, children }: { session: CurrentSession; children: React.ReactNode }) {
  const path = usePathname();
  const t = useTranslations("staffAccess");
  const codes = useTranslations("codes.role");
  if (!canOpen(path, session)) return <Page><Alert>{t("notAllowed")}</Alert><ButtonLink href={landing(session.role)}>{t("myWork")}</ButtonLink></Page>;
  if (path === "/dashboard" && !managesStock(session.role)) return <Page>
    <PageHeader title={t("welcome", { name: session.displayName ?? "" })} subtitle={session.role ? codes(session.role) : ""} />
    <p className="text-slate">{t(session.role === "PACKER" ? "packerHint" : "cashierHint")}</p>
    <ButtonLink className="self-start" href={landing(session.role)}>{t(session.role === "PACKER" ? "browseProducts" : "startSale")}</ButtonLink>
  </Page>;
  return children;
}
