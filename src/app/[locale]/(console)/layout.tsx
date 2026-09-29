import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { ResumeSession } from "@/components/resume-session";
import { Shell } from "@/components/shell";
import { accessToken, api, hasSessionCookie, tokenKind, withAccess } from "@/lib/backend";
import { registerCredential } from "@/lib/register-device";
export default async function ConsoleLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (tokenKind(await accessToken()) === "PICKER") redirect({ href: "/businesses", locale });
  const result = await withAccess(token => api(token).GET("/session"), { refresh: false });
  if (!result.response.ok || !result.data) {
    if (!(await hasSessionCookie())) redirect({ href: await registerCredential() ? "/register" : "/login", locale });
    return <ResumeSession />;
  }
  return <Shell session={result.data} organizationName={result.data.organizationName ?? ""} userName={result.data.displayName ?? ""}>{children}</Shell>;
}
