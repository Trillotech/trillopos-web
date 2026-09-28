import { setRequestLocale } from "next-intl/server";

import { AuthFrame } from "@/components/auth-frame";
import { SignupForm } from "@/components/auth-forms";

/** `?error=`: set when the form was posted without the page's script (see `@/lib/form-post`). */
export default async function SignupPage({
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
      <SignupForm initialError={error} />
    </AuthFrame>
  );
}
