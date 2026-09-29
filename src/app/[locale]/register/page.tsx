import { setRequestLocale } from "next-intl/server";
import { AuthFrame } from "@/components/auth-frame";
import { RegisterLogin } from "@/components/staff-entry";
export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  return <AuthFrame><RegisterLogin /></AuthFrame>;
}
