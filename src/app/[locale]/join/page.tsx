import { setRequestLocale } from "next-intl/server";
import { AuthFrame } from "@/components/auth-frame";
import { JoinForm } from "@/components/staff-entry";
export default async function JoinPage({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params; setRequestLocale(locale);
  const { error } = await searchParams;
  return <AuthFrame><JoinForm initialError={error} /></AuthFrame>;
}
