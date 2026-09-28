import { setRequestLocale } from "next-intl/server";

import { AuthFrame } from "@/components/auth-frame";
import { LoginForm } from "@/components/auth-forms";

/** `?error=`: set when the form was posted without the page's script (see `@/lib/form-post`). */
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error } = await searchParams;
  return (
    <AuthFrame>
      <LoginForm initialError={error} />
    </AuthFrame>
  );
}
