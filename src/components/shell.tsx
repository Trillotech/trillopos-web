"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BadgeIcon,
  BookIcon,
  BoxIcon,
  BuildingIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  ClockIcon,
  CloseIcon,
  GridIcon,
  HomeIcon,
  LayersIcon,
  MonitorIcon,
  MoreIcon,
  PlusIcon,
  ReceiptIcon,
  SettingsIcon,
  StoreIcon,
  TagIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import { ButtonLink, focusRing, insetFocusRing, SignOut } from "@/components/ui";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { SessionContext, useMembershipRole } from "@/lib/role";
import { canOpen, canSell, type CurrentSession } from "@/lib/permissions";
import { RoleContent } from "@/components/role-content";
import { routing } from "@/i18n/routing";

type IconType = (props: { className?: string }) => React.ReactNode;
type Item = { key: string; href: string; icon: IconType };
/** A block of the menu under a small heading; the first block has none. */
type Group = { heading?: string; items: Item[] };

const groups: Group[] = [
  { items: [{ key: "dashboard", href: "/dashboard", icon: GridIcon }] },
  {
    heading: "groupSell",
    items: [
      { key: "salesLog", href: "/sales", icon: ReceiptIcon },
      { key: "heldSales", href: "/sales/held", icon: ClockIcon },
      { key: "customers", href: "/customers", icon: UsersIcon },
    ],
  },
  {
    heading: "groupStock",
    items: [
      { key: "products", href: "/products", icon: BoxIcon },
      { key: "categories", href: "/categories", icon: TagIcon },
      { key: "stock", href: "/stock", icon: LayersIcon },
      { key: "suppliers", href: "/suppliers", icon: TruckIcon },
    ],
  },
  {
    heading: "groupMoney",
    items: [
      { key: "receivables", href: "/receivables", icon: ArrowDownLeftIcon },
      { key: "payables", href: "/payables", icon: ArrowUpRightIcon },
      { key: "expenses", href: "/expenses", icon: WalletIcon },
    ],
  },
];

/** Settings sit apart, at the foot of the menu, folded away until opened. */
const settings = {
  key: "settings",
  href: "/settings",
  pages: [
    { href: "/settings", key: "business", icon: BuildingIcon },
    { href: "/locations", key: "locations", icon: StoreIcon },
    { href: "/staff", key: "staff", icon: BadgeIcon },
    { href: "/registers", key: "registers", icon: MonitorIcon },
  ] satisfies Item[],
};

/** The phone's bottom bar: the four places a shop goes most, and More for the rest. */
const tabs: { key: string; href: string; icon: IconType; routes: string[]; primary?: boolean }[] = [
  { key: "home", href: "/dashboard", icon: HomeIcon, routes: ["/dashboard"] },
  { key: "sales", href: "/sales", icon: ReceiptIcon, routes: ["/sales", "/sales/held"] },
  { key: "sell", href: "/sales/new", icon: PlusIcon, routes: ["/sales/new"], primary: true },
  { key: "products", href: "/products", icon: BoxIcon, routes: ["/products", "/categories", "/stock", "/suppliers"] },
];

const known = [
  ...groups.flatMap((group) => group.items.map((item) => item.href)),
  ...settings.pages.map((page) => page.href),
  "/sales/new",
  "/account",
];

/** The most specific known route wins: /sales/held is not /sales, and a receipt at /sales/123 is. */
function activeHref(pathname: string) {
  return known
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function Shell({
  session,
  children,
  organizationName,
  userName,
}: {
  children: React.ReactNode;
  session: CurrentSession;
  organizationName: string;
  userName: string;
}) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const active = activeHref(pathname);

  // on a phone "More" opens a modal <dialog>: focus stays inside, Esc closes it, the page behind is inert
  useEffect(() => {
    const dialog = drawer.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog?.open) {
      dialog.close();
    }
  }, [open]);

  // turned sideways past the breakpoint, the sidebar takes over: never leave a hidden modal open
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 48rem)");
    const close = () => {
      if (wide.matches) {
        setOpen(false);
      }
    };
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  return (
    <SessionContext.Provider value={session}><div className="min-h-dvh bg-surface text-ink md:flex">
      <a
        className={`sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-button focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg ${focusRing}`}
        href="#main"
      >
        {t("skipToContent")}
      </a>

      {/* phones: a slim bar on top, the tab bar at the bottom */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white/95 px-4 backdrop-blur md:hidden">
        <Brand organizationName={organizationName} />
        <LanguageToggle />
      </header>

      <dialog
        aria-label={t("menu")}
        className="m-0 h-dvh max-h-none w-80 max-w-[85vw] border-0 bg-transparent p-0 text-ink backdrop:bg-[rgb(11_30_67/0.5)] md:hidden"
        onClick={(event) => {
          // a tap on the dimmed page beside the menu closes it
          if (event.target === event.currentTarget) {
            setOpen(false);
          }
        }}
        onClose={() => setOpen(false)}
        ref={drawer}
      >
        <div className="flex h-full flex-col bg-white shadow-pop">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
            <Brand organizationName={organizationName} />
            <button
              aria-label={t("close")}
              className={`inline-flex size-12 shrink-0 items-center justify-center rounded-button text-slate transition hover:bg-surface hover:text-ink motion-reduce:transition-none ${focusRing}`}
              onClick={() => setOpen(false)}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
          <Navigation session={session} active={active} onNavigate={() => setOpen(false)} />
          <div className="shrink-0 border-t border-line p-3">
            <AccountMenu onNavigate={() => setOpen(false)} organizationName={organizationName} userName={userName} />
          </div>
        </div>
      </dialog>

      {/* desktop: the sidebar */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col md:border-r md:border-line md:bg-white">
        <div className="flex h-16 shrink-0 items-center px-4">
          <Brand organizationName={organizationName} />
        </div>
        {canSell(session.role) ? <div className="shrink-0 px-3 pt-1 pb-2">
          <ButtonLink className="w-full" href="/sales/new">
            <PlusIcon className="size-5" />
            {t("newSale")}
          </ButtonLink>
        </div> : null}
        <Navigation session={session} active={active} />
        <div className="shrink-0 border-t border-line p-3">
          <AccountMenu organizationName={organizationName} userName={userName} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1 pb-20 focus:outline-hidden md:pb-0" id="main" tabIndex={-1}>
          <RoleContent session={session}>{children}</RoleContent>
        </main>
      </div>

      <TabBar session={session} active={active} menuOpen={open} onMore={() => setOpen(true)} />
    </div></SessionContext.Provider>
  );
}

function Brand({ organizationName }: { organizationName: string }) {
  const t = useTranslations("shell");
  const name = t("product");
  // the product name in two inks, the way the logo writes it: Trillo · POS
  const [head, tail] = name.endsWith("POS") ? [name.slice(0, -3), "POS"] : [name, ""];
  return (
    <Link className={`flex min-w-0 flex-1 items-center gap-3 rounded-button ${focusRing}`} href="/dashboard">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand font-display text-lg font-extrabold text-navy shadow-xs"
      >
        T
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[1.0625rem] leading-tight font-bold tracking-tight text-ink">
          {head}
          <span className="text-brand-ink">{tail}</span>
        </span>
        <span className="block truncate text-xs text-slate">{organizationName}</span>
      </span>
    </Link>
  );
}

/** Wide screens: a bar over the page with the day and the language. */
function TopBar() {
  const guide = useTranslations("guide");
  return (
    <div className="sticky top-0 z-20 hidden h-16 shrink-0 items-center gap-4 border-b border-line bg-white/85 px-8 backdrop-blur md:flex">
      <Today />
      <div className="ml-auto flex items-center gap-2">
        <LanguageToggle />
        <Link
          aria-label={guide("link")}
          className={`inline-flex size-10 items-center justify-center rounded-full text-slate transition hover:bg-surface hover:text-ink motion-reduce:transition-none ${focusRing}`}
          href="/guide"
          title={guide("link")}
        >
          <BookIcon className="size-5" />
        </Link>
      </div>
    </div>
  );
}

/** The date and the time, in the reader's language; drawn after the page loads, so server and phone agree. */
function Today() {
  const locale = useLocale();
  const [now, setNow] = useState<Date>();

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  if (!now) {
    return <span className="h-5" />;
  }
  const day = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(now);
  return (
    <p className="flex items-center gap-2 text-sm">
      <ClockIcon className="size-4 text-slate" />
      <span className="font-semibold text-ink">{day}</span>
      <span className="text-slate tabular-nums">{time}</span>
    </p>
  );
}

/** English or Burmese, one tap, on every screen. */
function LanguageToggle() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div aria-label={t("label")} className="flex shrink-0 rounded-full border border-line bg-surface p-0.5" role="group">
      {routing.locales.map((code) => (
        <button
          aria-label={t(code)}
          aria-pressed={code === locale}
          className={`min-h-10 rounded-full px-3 text-xs font-semibold transition-colors motion-reduce:transition-none md:min-h-8 ${focusRing} ${
            code === locale ? "bg-navy text-white shadow-xs" : "text-slate hover:text-ink"
          }`}
          key={code}
          lang={code}
          onClick={() => router.replace(pathname, { locale: code })}
          type="button"
        >
          <span className="font-myanmar">{code === "en" ? "EN" : t(code)}</span>
        </button>
      ))}
    </div>
  );
}

const row = `group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors motion-reduce:transition-none md:h-9 ${insetFocusRing}`;
const idle = "font-medium text-slate-700 hover:bg-surface hover:text-ink";
const here = "bg-navy font-semibold text-white shadow-sm";

/**
 * The menu: every page one tap away, under a few headings. Settings stay folded away until opened;
 * they open by themselves on a settings page, and stay as you leave them.
 */
function Navigation({ session, active, onNavigate }: { session: CurrentSession; active?: string; onNavigate?: () => void }) {
  const t = useTranslations("shell");
  const id = useId();
  const inSettings = settings.pages.some((page) => page.href === active);
  const [settingsToggled, setSettingsToggled] = useState<boolean>();
  const settingsOpen = settingsToggled ?? inSettings;

  const visible = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => canOpen(item.href, session)) }))
    .filter((group) => group.items.length > 0);
  const settingsPages = settings.pages.filter((page) => canOpen(page.href, session));

  function link(item: Item) {
    const Icon = item.icon;
    const selected = active === item.href;
    return (
      <li key={item.href}>
        <Link
          aria-current={selected ? "page" : undefined}
          className={`${row} ${selected ? here : idle}`}
          href={item.href}
          onClick={onNavigate}
        >
          <Icon className={`size-5 shrink-0 ${selected ? "text-brand" : "text-slate-400 group-hover:text-slate-600"}`} />
          <span className="min-w-0 flex-1 truncate">{t(item.key)}</span>
        </Link>
      </li>
    );
  }

  return (
    <nav
      aria-label={t("menu")}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3 [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]"
    >
      {visible.map((group, index) => {
        const headingId = `${id}-group-${index}`;
        return (
          <div key={group.heading ?? "start"}>
            {group.heading ? (
              <p className="px-3 pt-5 pb-1.5 text-[0.6875rem] font-semibold tracking-[0.08em] text-slate uppercase" id={headingId}>
                {t(group.heading)}
              </p>
            ) : null}
            <ul aria-labelledby={group.heading ? headingId : undefined} className={`flex flex-col gap-0.5 ${group.heading ? "" : "pt-2"}`}>
              {group.items.map(link)}
            </ul>
          </div>
        );
      })}
      {canOpen(settings.href, session) && settingsPages.length > 0 ? (
        <ul className="mt-auto flex flex-col gap-0.5 pt-5">
          <li>
            <button
              aria-controls={`${id}-settings`}
              aria-expanded={settingsOpen}
              className={`${row} ${inSettings ? "font-semibold text-ink hover:bg-surface" : idle}`}
              onClick={() => setSettingsToggled(!settingsOpen)}
              type="button"
            >
              <SettingsIcon className={`size-5 shrink-0 ${inSettings ? "text-brand-ink" : "text-slate-400 group-hover:text-slate-600"}`} />
              <span className="min-w-0 flex-1 truncate text-left">{t(settings.key)}</span>
              <ChevronDownIcon
                className={`size-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${settingsOpen ? "" : "-rotate-90"}`}
              />
            </button>
            <ul className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 border-l border-line pl-2" hidden={!settingsOpen} id={`${id}-settings`}>
              {settingsPages.map(link)}
            </ul>
          </li>
        </ul>
      ) : null}
    </nav>
  );
}

const menuItem = `flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:opacity-60 motion-reduce:transition-none md:h-9 ${insetFocusRing}`;

/** Who is signed in; opens a small menu with the account, the guide and sign-out. */
function AccountMenu({
  userName,
  organizationName,
  onNavigate,
}: {
  userName: string;
  organizationName: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("shell");
  const staff = useTranslations("staffAccess");
  const roles = useTranslations("codes.role");
  const { register, role } = useMembershipRole();
  const guide = useTranslations("guide");
  const id = useId();
  const initial = Array.from(userName.trim())[0]?.toUpperCase() ?? "?";

  function close() {
    document.getElementById(id)?.hidePopover();
  }

  return (
    <>
      <button
        aria-label={`${t("accountMenu")}: ${userName}`}
        className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-surface motion-reduce:transition-none ${insetFocusRing}`}
        popoverTarget={id}
        type="button"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy font-display text-sm font-bold text-brand"
        >
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{userName}</span>
          <span className="block truncate text-xs text-slate">{organizationName}{role ? ` · ${roles(role)}` : ""}</span>
        </span>
        <ChevronUpDownIcon className="size-4 shrink-0 text-slate-400" />
      </button>
      <div
        className="fixed top-auto right-auto bottom-20 left-3 m-0 w-64 rounded-xl border border-line bg-white p-2 text-ink shadow-pop"
        id={id}
        popover="auto"
      >
        {!register ? <Link
          className={menuItem}
          href="/account"
          onClick={() => {
            close();
            onNavigate?.();
          }}
        >
          <UserIcon className="size-5 shrink-0 text-slate" />
          {t("account")}
        </Link> : null}
        {!register ? <Link className={menuItem} href="/join" onClick={close}>
          <PlusIcon className="size-5 shrink-0 text-slate" />
          {staff("joinAnother")}
        </Link> : null}
        <Link
          className={menuItem}
          href="/guide"
          onClick={() => {
            close();
            onNavigate?.();
          }}
        >
          <BookIcon className="size-5 shrink-0 text-slate" />
          {guide("link")}
        </Link>
        <div className="my-2 border-t border-line" />
        <SignOut className={menuItem} label={register ? staff("switchStaff") : t("signOut")} pendingLabel={t("signingOut")} />
      </div>
    </>
  );
}

/** Phones only: always visible, one tap to the places a shop goes most, with Sell raised in the middle. */
function TabBar({ session, active, menuOpen, onMore }: { session: CurrentSession; active?: string; menuOpen: boolean; onMore: () => void }) {
  const t = useTranslations("shell");
  const visibleTabs = tabs.filter(tab => canOpen(tab.href, session));
  const current = visibleTabs.find((tab) => active && tab.routes.includes(active));
  const label = "block max-w-full truncate px-1 text-[0.6875rem]";
  return (
    <nav
      aria-label={t("tabs")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(11_30_67/0.35)] backdrop-blur md:hidden"
    >
      <ul className="grid h-16" style={{ gridTemplateColumns: `repeat(${visibleTabs.length + 1}, minmax(0, 1fr))` }}>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const selected = current?.key === tab.key;
          return (
            <li key={tab.key}>
              <Link
                aria-current={selected ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 ${insetFocusRing}`}
                href={tab.href}
              >
                {tab.primary ? (
                  <span className="-mt-7 flex size-14 items-center justify-center rounded-full bg-brand text-navy shadow-lg ring-4 ring-white">
                    <Icon className="size-6" />
                  </span>
                ) : (
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors motion-reduce:transition-none ${
                      selected ? "bg-brand-soft text-navy" : "text-slate"
                    }`}
                  >
                    <Icon className="size-6" />
                  </span>
                )}
                <span className={`${label} ${selected || tab.primary ? "font-semibold text-navy" : "font-medium text-slate"}`}>
                  {t(tab.key)}
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            className={`flex h-full w-full flex-col items-center justify-center gap-0.5 ${insetFocusRing}`}
            onClick={onMore}
            type="button"
          >
            <span
              className={`flex h-8 w-14 items-center justify-center rounded-full ${
                !current ? "bg-brand-soft text-navy" : "text-slate"
              }`}
            >
              <MoreIcon className="size-6" />
            </span>
            <span className={`${label} ${!current ? "font-semibold text-navy" : "font-medium text-slate"}`}>
              {t("more")}
            </span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
