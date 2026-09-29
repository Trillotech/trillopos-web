"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  BookIcon,
  BoxIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  CloseIcon,
  HomeIcon,
  MoreIcon,
  PlusIcon,
  ReceiptIcon,
  SettingsIcon,
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
type Page = { href: string; key: string };
/** A row in the menu: a page of its own, or a section whose pages open under it. */
type Section = { key: string; href: string; icon: IconType; pages?: Page[] };

const sections: Section[] = [
  { key: "dashboard", href: "/dashboard", icon: HomeIcon },
  {
    key: "sales",
    href: "/sales",
    icon: ReceiptIcon,
    pages: [
      { href: "/sales", key: "salesLog" },
      { href: "/sales/held", key: "heldSales" },
    ],
  },
  {
    key: "products",
    href: "/products",
    icon: BoxIcon,
    pages: [
      { href: "/products", key: "allProducts" },
      { href: "/categories", key: "categories" },
      { href: "/stock", key: "stock" },
      { href: "/suppliers", key: "suppliers" },
    ],
  },
  { key: "customers", href: "/customers", icon: UsersIcon },
  {
    key: "groupMoney",
    href: "/receivables",
    icon: WalletIcon,
    pages: [
      { href: "/receivables", key: "receivables" },
      { href: "/payables", key: "payables" },
      { href: "/expenses", key: "expenses" },
    ],
  },
];

/** Settings sit apart, at the foot of the menu. */
const settings: Section = {
  key: "settings",
  href: "/settings",
  icon: SettingsIcon,
  pages: [
    { href: "/settings", key: "business" },
    { href: "/locations", key: "locations" },
    { href: "/staff", key: "staff" },
    { href: "/registers", key: "registers" },
  ],
};

/** The phone's bottom bar: the four places a shop goes most, and More for the rest. */
const tabs: { key: string; href: string; icon: IconType; routes: string[]; primary?: boolean }[] = [
  { key: "home", href: "/dashboard", icon: HomeIcon, routes: ["/dashboard"] },
  { key: "sales", href: "/sales", icon: ReceiptIcon, routes: ["/sales", "/sales/held"] },
  { key: "sell", href: "/sales/new", icon: PlusIcon, routes: ["/sales/new"], primary: true },
  { key: "products", href: "/products", icon: BoxIcon, routes: ["/products", "/categories", "/stock", "/suppliers"] },
];

const known = [
  ...[...sections, settings].flatMap((section) => [section.href, ...(section.pages ?? []).map((page) => page.href)]),
  "/sales/new",
  "/account",
];

/** The most specific known route wins: /sales/held is not /sales, and a receipt at /sales/123 is. */
function activeHref(pathname: string) {
  return known
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

function sectionOf(active?: string) {
  return [...sections, settings].find(
    (section) => (section.pages ? section.pages.some((page) => page.href === active) : section.href === active),
  )?.key;
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
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-line bg-white/95 px-4 backdrop-blur md:hidden">
        <Brand organizationName={organizationName} />
      </header>

      <dialog
        aria-label={t("menu")}
        className="m-0 h-dvh max-h-none w-80 max-w-[85vw] border-0 bg-transparent p-0 text-ink backdrop:bg-[rgb(15_23_42/0.45)] md:hidden"
        onClick={(event) => {
          // a tap on the dimmed page beside the menu closes it
          if (event.target === event.currentTarget) {
            setOpen(false);
          }
        }}
        onClose={() => setOpen(false)}
        ref={drawer}
      >
        <div className="flex h-full flex-col bg-white shadow-xl">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
            <Brand organizationName={organizationName} />
            <button
              aria-label={t("close")}
              className={`inline-flex size-12 shrink-0 items-center justify-center rounded-button text-slate transition hover:bg-slate-100 hover:text-ink motion-reduce:transition-none ${focusRing}`}
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
        {canSell(session.role) ? <div className="shrink-0 px-3 pb-2">
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

      <main className="min-w-0 flex-1 pb-16 focus:outline-hidden md:pb-0" id="main" tabIndex={-1}>
        <RoleContent session={session}>{children}</RoleContent>
      </main>

      <TabBar session={session} active={active} menuOpen={open} onMore={() => setOpen(true)} />
    </div></SessionContext.Provider>
  );
}

function Brand({ organizationName }: { organizationName: string }) {
  const t = useTranslations("shell");
  return (
    <Link className={`flex min-w-0 flex-1 items-center gap-3 rounded-button ${focusRing}`} href="/dashboard">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo text-sm font-extrabold text-white shadow-xs"
      >
        T
      </span>
      <span className="min-w-0">
        <span className="block text-base leading-tight font-bold tracking-tight text-ink">{t("product")}</span>
        <span className="block truncate text-xs text-slate">{organizationName}</span>
      </span>
    </Link>
  );
}

const row = `group flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors motion-reduce:transition-none md:h-9 ${insetFocusRing}`;
const idle = "font-medium text-slate-600 hover:bg-slate-100 hover:text-ink";
const here = "bg-indigo-50 font-semibold text-indigo-700";

/**
 * The menu. A section's pages stay folded away until it is opened; the section of the page you
 * are on opens by itself, and any section you open stays open until you close it.
 */
function Navigation({ session, active, onNavigate }: { session: CurrentSession; active?: string; onNavigate?: () => void }) {
  const t = useTranslations("shell");
  const id = useId();
  const current = sectionOf(active);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => toggled[key] ?? key === current;

  function item(section: Section) {
    const Icon = section.icon;
    if (!section.pages) {
      const selected = active === section.href;
      return (
        <li key={section.key}>
          <Link
            aria-current={selected ? "page" : undefined}
            className={`${row} ${selected ? here : idle}`}
            href={section.href}
            onClick={onNavigate}
          >
            <Icon className={`size-5 shrink-0 ${selected ? "text-indigo" : "text-slate-400 group-hover:text-slate-600"}`} />
            {t(section.key)}
          </Link>
        </li>
      );
    }
    const open = isOpen(section.key);
    const inside = current === section.key;
    const list = `${id}-${section.key}`;
    return (
      <li key={section.key}>
        <button
          aria-controls={list}
          aria-expanded={open}
          className={`${row} ${inside ? "font-semibold text-ink hover:bg-slate-100" : idle}`}
          onClick={() => setToggled((state) => ({ ...state, [section.key]: !open }))}
          type="button"
        >
          <Icon className={`size-5 shrink-0 ${inside ? "text-indigo" : "text-slate-400 group-hover:text-slate-600"}`} />
          <span className="min-w-0 flex-1 truncate text-left">{t(section.key)}</span>
          <ChevronDownIcon
            className={`size-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
          />
        </button>
        <ul className="mt-0.5 mb-1 ml-6 flex flex-col gap-0.5 border-l border-line pl-2" hidden={!open} id={list}>
          {section.pages.map((page) => {
            const selected = active === page.href;
            return (
              <li key={page.href}>
                <Link
                  aria-current={selected ? "page" : undefined}
                  className={`flex h-11 items-center rounded-lg px-3 text-sm transition-colors motion-reduce:transition-none md:h-8 ${insetFocusRing} ${
                    selected ? here : "font-medium text-slate-600 hover:bg-slate-100 hover:text-ink"
                  }`}
                  href={page.href}
                  onClick={onNavigate}
                >
                  <span className="truncate">{t(page.key)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </li>
    );
  }

  return (
    <nav
      aria-label={t("menu")}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2 [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]"
    >
      <ul className="flex flex-col gap-0.5">{sections.filter(section => canOpen(section.href, session)).map(section => item({ ...section, pages: section.pages?.filter(page => canOpen(page.href, session)) }))}</ul>
      <ul className="mt-auto flex flex-col gap-0.5 pt-4">{canOpen(settings.href, session) ? item({ ...settings, pages: settings.pages?.filter(page => canOpen(page.href, session)) }) : null}</ul>
    </nav>
  );
}

const menuItem = `flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink transition-colors hover:bg-slate-100 disabled:opacity-60 motion-reduce:transition-none md:h-9 ${insetFocusRing}`;

/** Who is signed in; opens a small menu with the account, the language and sign-out. */
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
  const language = useTranslations("language");
  const staff = useTranslations("staffAccess");
  const roles = useTranslations("codes.role");
  const { register, role } = useMembershipRole();
  const guide = useTranslations("guide");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const id = useId();
  const initial = Array.from(userName.trim())[0]?.toUpperCase() ?? "?";

  function close() {
    document.getElementById(id)?.hidePopover();
  }

  return (
    <>
      <button
        aria-label={`${t("accountMenu")}: ${userName}`}
        className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-100 motion-reduce:transition-none ${insetFocusRing}`}
        popoverTarget={id}
        type="button"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700"
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
        className="fixed top-auto right-auto bottom-20 left-3 m-0 w-64 rounded-xl border border-line bg-white p-2 text-ink shadow-lg"
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
          <UserIcon className="size-5 shrink-0 text-slate-500" />
          {t("account")}
        </Link> : null}
        {!register ? <Link className={menuItem} href="/join" onClick={close}>{staff("joinAnother")}</Link> : null}
        <Link
          className={menuItem}
          href="/guide"
          onClick={() => {
            close();
            onNavigate?.();
          }}
        >
          <BookIcon className="size-5 shrink-0 text-slate-500" />
          {guide("link")}
        </Link>
        <div className="my-2 border-t border-line" />
        <p className="px-3 pb-1 text-xs font-semibold text-slate-500">{language("label")}</p>
        {routing.locales.map((code) => (
          <button
            aria-pressed={code === locale}
            className={menuItem}
            key={code}
            onClick={() => {
              close();
              router.replace(pathname, { locale: code });
            }}
            type="button"
          >
            <span className="flex-1 text-left font-myanmar">{language(code)}</span>
            {code === locale ? <CheckIcon className="size-4 shrink-0 text-indigo" /> : null}
          </button>
        ))}
        <div className="my-2 border-t border-line" />
        <SignOut className={menuItem} label={register ? staff("switchStaff") : t("signOut")} pendingLabel={t("signingOut")} />
      </div>
    </>
  );
}

/** Phones only: always visible, one tap to the places a shop goes most (Material 3 navigation bar). */
function TabBar({ session, active, menuOpen, onMore }: { session: CurrentSession; active?: string; menuOpen: boolean; onMore: () => void }) {
  const t = useTranslations("shell");
  const visibleTabs = tabs.filter(tab => canOpen(tab.href, session));
  const current = visibleTabs.find((tab) => active && tab.routes.includes(active));
  const label = "block max-w-full truncate px-1 text-xs";
  return (
    <nav
      aria-label={t("tabs")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid h-16" style={{ gridTemplateColumns: `repeat(${visibleTabs.length + 1}, minmax(0, 1fr))` }}>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const selected = current?.key === tab.key;
          return (
            <li key={tab.key}>
              <Link
                aria-current={selected ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 ${insetFocusRing}`}
                href={tab.href}
              >
                {tab.primary ? (
                  <span className="flex size-9 items-center justify-center rounded-full bg-indigo text-white shadow-md">
                    <Icon className="size-5" />
                  </span>
                ) : (
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors motion-reduce:transition-none ${
                      selected ? "bg-indigo-50 text-indigo" : "text-slate-500"
                    }`}
                  >
                    <Icon className="size-6" />
                  </span>
                )}
                <span className={`${label} ${selected || tab.primary ? "font-semibold text-indigo-700" : "font-medium text-slate-600"}`}>
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
            className={`flex h-full w-full flex-col items-center justify-center gap-1 ${insetFocusRing}`}
            onClick={onMore}
            type="button"
          >
            <span
              className={`flex h-8 w-14 items-center justify-center rounded-full ${
                !current ? "bg-indigo-50 text-indigo" : "text-slate-500"
              }`}
            >
              <MoreIcon className="size-6" />
            </span>
            <span className={`${label} ${!current ? "font-semibold text-indigo-700" : "font-medium text-slate-600"}`}>
              {t("more")}
            </span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
