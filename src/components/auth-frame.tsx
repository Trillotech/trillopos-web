import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/language-switcher";

export async function AuthFrame({ children }: { children: React.ReactNode }) {
  const brand = await getTranslations("brand");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-button bg-brand font-display text-sm font-extrabold text-navy"
          >
            T
          </span>
          {brand("name")}
        </p>
        <LanguageSwitcher />
      </div>
      <section className="rounded-panel border border-line bg-white p-6 shadow-sm sm:p-8">{children}</section>
    </main>
  );
}
