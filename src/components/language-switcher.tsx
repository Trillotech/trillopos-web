"use client";

import { useLocale, useTranslations } from "next-intl";

import { ChevronDownIcon, GlobeIcon } from "@/components/icons";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LanguageSwitcher({ fullWidth = false }: { fullWidth?: boolean }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className={`relative flex items-center ${fullWidth ? "w-full" : ""}`}>
      <span className="sr-only">{t("label")}</span>
      <GlobeIcon className="pointer-events-none absolute left-4 size-4 text-slate" />
      <select
        className={`min-h-12 cursor-pointer appearance-none rounded-button border border-line bg-white pr-10 pl-10 font-myanmar text-sm font-medium text-ink shadow-xs transition hover:border-slate-300 focus:border-brand-ink focus:ring-3 focus:ring-brand/25 focus:outline-hidden motion-reduce:transition-none md:min-h-10 ${
          fullWidth ? "w-full" : ""
        }`}
        value={locale}
        onChange={(event) => router.replace(pathname, { locale: event.target.value })}
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {t(code)}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-4 size-4 text-slate" />
    </label>
  );
}
