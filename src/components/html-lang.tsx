"use client";

import { useEffect } from "react";

/**
 * Keeps <html lang> right when the language is switched inside the app: the root layout is not
 * rendered again then, and Burmese needs its own font and taller lines (globals.css, html[lang="my"]).
 * Also marks <html data-hydrated> once the app's script runs the page (the end-to-end tests wait for it).
 */
export function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.hydrated = "true";
  }, [locale]);
  return null;
}
