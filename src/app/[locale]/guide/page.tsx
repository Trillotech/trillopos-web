import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { GuideShot } from "@/components/guide-shot";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ButtonLink } from "@/components/ui";
import { Link } from "@/i18n/navigation";

type Params = { params: Promise<{ locale: string }> };
type Shot = { src: string; height: number; caption: string; zoomLabel: string };

const chapters = ["menu", "start", "orders", "courier", "returns", "stock", "expenses", "day", "password", "help"] as const;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guide" });
  return { title: `${t("metaTitle")} · TrilloPOS`, description: t("lede") };
}

/**
 * The shop guide for a new owner. Public, so it can be sent as a link before the shop exists; the
 * screenshots under public/guide/<locale> come from a sample shop, in the same language as the text.
 */
export default async function GuidePage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("guide");
  const rich = (key: string) =>
    t.rich(key, {
      b: (chunks) => <strong className="font-semibold text-ink">{chunks}</strong>,
      i: (chunks) => <em>{chunks}</em>,
    });
  const shot = (file: string, captionKey: string, height = 1688): Shot => {
    const caption = t(captionKey);
    return { src: `/guide/${locale}/${file}.webp`, height, caption, zoomLabel: t("zoom", { caption }) };
  };
  const strip = (...shots: Shot[]) => <ShotStrip closeLabel={t("zoomClose")} shots={shots} swipe={t("swipe")} />;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16">
      <header className="flex items-center justify-between gap-4 py-4">
        <Link className="flex items-center gap-2 rounded-button text-lg font-bold tracking-tight text-ink" href="/dashboard">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-button bg-brand font-display text-sm font-extrabold text-navy"
          >
            T
          </span>
          TrilloPOS
        </Link>
        <LanguageSwitcher />
      </header>

      <div className="flex max-w-2xl flex-col gap-4 py-8 sm:py-12">
        <p className="text-sm font-semibold tracking-wide text-brand-ink uppercase">{t("eyebrow")}</p>
        <h1 className="text-3xl font-bold tracking-tight text-balance text-ink sm:text-5xl">{t("title")}</h1>
        <p className="text-lg text-slate">{t("lede")}</p>
        <div>
          <ButtonLink href="/dashboard" size="lg">
            {t("open")}
          </ButtonLink>
        </div>
        <div className="flex flex-col gap-1 text-sm text-slate">
          <p>{t("languageNote")}</p>
          <p>{rich("sampleNote")}</p>
        </div>
      </div>

      <nav
        aria-label={t("chapters")}
        className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto border-y border-line bg-surface/95 px-4 py-2 backdrop-blur [scrollbar-width:none]"
      >
        {chapters.map((id) => (
          <a
            className="shrink-0 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium whitespace-nowrap text-ink hover:border-brand-ink"
            href={`#${id}`}
            key={id}
          >
            {t(`nav.${id}`)}
          </a>
        ))}
      </nav>

      {/* running text a shade lighter than ink, so the bold button and menu names stand out (Burmese too) */}
      <main className="text-base leading-relaxed text-slate-700">
        <Chapter id="menu" title={t("menu.title")}>
          <Step shots={strip(shot("more-menu", "menu.shot"))}>
            <p>{t("menu.intro")}</p>
            <List items={["home", "sales", "sell", "products", "more"].map((key) => rich(`menu.${key}`))} />
            <p>{rich("menu.paths")}</p>
          </Step>
        </Chapter>

        <Chapter id="start" intro={t("start.intro")} title={t("start.title")}>
          <Step
            label={t("step", { number: 1 })}
            shots={strip(shot("sign-in", "start.signInShot"), shot("create-business", "start.createShot", 1820))}
            title={t("start.createTitle")}
          >
            <p>{rich("start.createBody")}</p>
          </Step>
          <Step
            label={t("step", { number: 2 })}
            shots={strip(shot("settings-type-tax", "start.typeShot"), shot("settings-credit", "start.creditShot"))}
            title={t("start.setupTitle")}
          >
            <p>{rich("start.setupIntro")}</p>
            <List items={["setupType", "setupTax", "setupCredit", "setupDays"].map((key) => rich(`start.${key}`))} />
            <p>{rich("start.setupSave")}</p>
          </Step>
          <Step
            label={t("step", { number: 3 })}
            shots={strip(shot("product-price", "start.priceShot"), shot("product-stock", "start.stockShot"))}
            title={t("start.productsTitle")}
          >
            <p>{rich("start.productsIntro")}</p>
            <List items={["productsCost", "productsQty", "productsReorder"].map((key) => rich(`start.${key}`))} />
            <Callout title={t("start.sellOnlineTitle")} tone="warn">
              {t("start.sellOnlineBody")}
            </Callout>
          </Step>
        </Chapter>

        <Chapter id="orders" intro={t("orders.intro")} title={t("orders.title")}>
          <Step label={t("step", { number: 1 })} shots={strip(shot("new-sale", "orders.addShot", 2000))} title={t("orders.addTitle")}>
            <p>{rich("orders.addBody")}</p>
            <p>{t("orders.addTap")}</p>
          </Step>
          <Step
            label={t("step", { number: 2 })}
            shots={strip(shot("sale-customer", "orders.customerShot"), shot("sale-payment", "orders.paymentShot"))}
            title={t("orders.payTitle")}
          >
            <p>{rich("orders.payBody")}</p>
            <ul className="flex flex-col gap-2">
              {(["wallet", "cod", "cash"] as const).map((way) => (
                <li className="flex flex-col gap-0.5 rounded-xl border border-line bg-white p-3.5" key={way}>
                  <span className="text-xs font-semibold tracking-wide text-slate uppercase">{t(`orders.${way}How`)}</span>
                  <span>{rich(`orders.${way}What`)}</span>
                </li>
              ))}
            </ul>
          </Step>
          <Step label={t("step", { number: 3 })} shots={strip(shot("receipt", "orders.receiptShot"))} title={t("orders.chargeTitle")}>
            <p>{t("orders.chargeBody")}</p>
            <p>{t("orders.chargeStock")}</p>
          </Step>
        </Chapter>

        <Chapter id="courier" title={t("courier.title")}>
          <Step shots={strip(shot("owed-to-you", "courier.listShot"), shot("record-repayment", "courier.repayShot", 1920))}>
            <p>{rich("courier.body")}</p>
            <p>{rich("courier.steps")}</p>
            <Callout title={t("courier.feesTitle")} tone="tip">
              {rich("courier.feesBody")}
            </Callout>
          </Step>
        </Chapter>

        <Chapter id="returns" title={t("returns.title")}>
          <Step shots={strip(shot("return", "returns.shot"))}>
            <p>{rich("returns.body")}</p>
            <p>{rich("returns.restock")}</p>
            <List items={[rich("returns.cod"), rich("returns.paid")]} />
            <p>{rich("returns.submit")}</p>
          </Step>
        </Chapter>

        <Chapter id="stock" title={t("stock.title")}>
          <Step shots={strip(shot("stock-entry", "stock.shot"))}>
            <p>{rich("stock.body")}</p>
            <p>{rich("stock.owe")}</p>
          </Step>
        </Chapter>

        <Chapter id="expenses" title={t("expenses.title")}>
          <Step shots={strip(shot("expenses", "expenses.shot"))}>
            <p>{rich("expenses.body")}</p>
            <p>{rich("expenses.categories")}</p>
          </Step>
        </Chapter>

        <Chapter id="day" title={t("day.title")}>
          <Step shots={strip(shot("dashboard", "day.shot", 2000))}>
            <p>{rich("day.intro")}</p>
            <List items={["sales", "profit", "owed", "owe", "low"].map((key) => rich(`day.${key}`))} />
          </Step>
        </Chapter>

        <Chapter id="password" title={t("password.title")}>
          <div className="flex max-w-2xl flex-col gap-3">
            <p>{rich("password.change")}</p>
            <p>{rich("password.forgot")}</p>
          </div>
        </Chapter>

        <Chapter id="help" title={t("help.title")}>
          <div className="flex max-w-2xl flex-col gap-3">
            <p>{t("help.report")}</p>
            <p>{t("help.history")}</p>
          </div>
        </Chapter>
      </main>

      <footer className="border-t border-line pt-6 text-sm text-slate">TrilloPOS · Trillotech</footer>
    </div>
  );
}

function Chapter({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="flex scroll-mt-16 flex-col gap-8 border-b border-line py-10 last:border-b-0 sm:py-12" id={id}>
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-balance text-ink sm:text-3xl">{title}</h2>
        {intro ? <p className="text-slate">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Text on the left and the phone screens on the right; on a phone the screens follow the text. */
function Step({
  label,
  title,
  shots,
  children,
}: {
  label?: string;
  title?: string;
  shots: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10">
      <div className="flex max-w-2xl flex-col gap-3">
        {label ? <p className="font-mono text-xs font-medium tracking-widest text-brand-ink uppercase">{label}</p> : null}
        {title ? <h3 className="text-xl font-semibold tracking-tight text-ink">{title}</h3> : null}
        {children}
      </div>
      {shots}
    </div>
  );
}

/** Two screens side by side on a laptop; on a phone they scroll sideways, one screen at a time. */
function ShotStrip({ shots, swipe, closeLabel }: { shots: Shot[]; swipe: string; closeLabel: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        className={`-mx-4 flex snap-x snap-mandatory scroll-px-4 items-start gap-4 overflow-x-auto px-4 pb-3 lg:mx-0 lg:justify-end lg:overflow-visible lg:px-0 lg:pb-0 ${
          shots.length === 1 ? "justify-center" : ""
        }`}
      >
        {shots.map((shot) => (
          <GuideShot closeLabel={closeLabel} key={shot.src} {...shot} />
        ))}
      </div>
      {shots.length > 1 ? (
        <p aria-hidden="true" className="text-center text-xs text-slate lg:hidden">
          {swipe}
        </p>
      ) : null}
    </div>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-brand-ink">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function Callout({ tone, title, children }: { tone: "warn" | "tip"; title: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl border p-4 ${tone === "warn" ? "border-amber-300 bg-amber-50" : "border-teal-200 bg-teal-50"}`}>
      <p className={`font-semibold ${tone === "warn" ? "text-amber-900" : "text-teal"}`}>{title}</p>
      <p>{children}</p>
    </div>
  );
}
