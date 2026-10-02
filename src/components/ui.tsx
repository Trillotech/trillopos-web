"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  AlertIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CloseIcon,
  InfoIcon,
  LogoutIcon,
  SearchIcon,
  Spinner,
} from "@/components/icons";
import { Link, useRouter } from "@/i18n/navigation";

/** The keyboard focus ring every control shares; a mouse or a finger never leaves it behind. */
export const focusRing =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2";

/** The same ring drawn inside the edge, for rows in a list that clips its corners. */
export const insetFocusRing =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-inset";

/** An inline link inside a sentence or under a form. */
export const linkClasses = `rounded-sm font-semibold text-brand-ink underline-offset-4 hover:underline ${focusRing}`;

/** A square button that shows only an icon; the label is what a screen reader says and the tooltip shows. */
export function IconButton({
  label,
  tone = "default",
  className = "",
  children,
  ...props
}: { label: string; tone?: "default" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const colours = tone === "danger" ? "text-slate hover:bg-red-50 hover:text-danger" : "text-slate hover:bg-surface hover:text-ink";
  return (
    <button
      aria-label={label}
      className={`inline-flex size-12 shrink-0 items-center justify-center rounded-button transition motion-reduce:transition-none sm:size-10 ${focusRing} ${colours} ${className}`}
      title={label}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

const menuRow = `flex min-h-12 w-full items-center gap-2 rounded-button px-4 text-sm transition-colors motion-reduce:transition-none md:min-h-10 ${focusRing}`;

/** Signs out on this phone or browser, then goes to the sign-in page. */
export function SignOut({
  label,
  pendingLabel,
  className = `${menuRow} font-medium text-slate hover:bg-surface hover:text-ink disabled:opacity-60`,
}: {
  label: string;
  pendingLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const response = await fetch("/api/auth/logout", { method: "POST" });
        router.replace(response.headers.get("X-Login-Path") === "/register" ? "/register" : "/login");
        router.refresh();
      }}
      type="button"
    >
      {pending ? <Spinner className="size-5" /> : <LogoutIcon className="size-5" />}
      {pending && pendingLabel ? pendingLabel : label}
    </button>
  );
}

/** One page's column: the same gutters and the same space between sections everywhere. */
export function Page({
  children,
  width = "wide",
  className = "",
}: {
  children: React.ReactNode;
  width?: "wide" | "narrow";
  className?: string;
}) {
  return (
    <div
      className={`mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 ${
        width === "narrow" ? "max-w-3xl" : "max-w-7xl"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-tight text-ink sm:text-[2rem]">{title}</h1>
        {subtitle ? <div className="text-sm text-slate">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

type Variant = "primary" | "navy" | "secondary" | "danger" | "dangerSolid" | "ghost";

const variants: Record<Variant, string> = {
  // saffron with navy text: white on saffron would be too faint to read
  primary: "bg-brand text-navy shadow-xs not-disabled:hover:bg-brand-hover not-disabled:active:bg-brand-active",
  navy: "bg-navy text-white shadow-xs not-disabled:hover:bg-navy-hover not-disabled:active:bg-navy",
  secondary:
    "border border-line bg-white text-ink shadow-xs not-disabled:hover:border-slate-300 not-disabled:hover:bg-surface not-disabled:active:bg-slate-100",
  danger:
    "border border-red-200 bg-white text-danger not-disabled:hover:border-red-300 not-disabled:hover:bg-red-50 not-disabled:active:bg-red-100",
  dangerSolid: "bg-danger text-white shadow-xs not-disabled:hover:bg-red-700 not-disabled:active:bg-red-800",
  ghost: "text-brand-ink not-disabled:hover:bg-brand-soft not-disabled:active:bg-brand-soft",
};

/** "lg" is for the one action a screen exists for, such as Charge: 48px everywhere, larger text. */
type Size = "md" | "lg";

/** Classes for anything that looks like a button: a button, or a link that goes somewhere. */
export function buttonClasses(variant: Variant = "primary", className = "", size: Size = "md") {
  const sizing = size === "lg" ? "min-h-12 px-6 text-base" : "min-h-12 px-4 text-sm sm:min-h-10";
  return `inline-flex select-none items-center justify-center gap-2 rounded-button py-2 text-center font-semibold transition motion-reduce:transition-none not-disabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${focusRing} ${variants[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  busy = false,
  className = "",
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; busy?: boolean }) {
  return (
    <button
      aria-busy={busy || undefined}
      className={buttonClasses(variant, className, size)}
      disabled={disabled || busy}
      {...props}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

/** A link that looks like a button: "New sale", "Add product". */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClasses(variant, className, size)} {...props} />;
}

const control =
  "min-h-12 w-full rounded-control border border-line bg-white px-4 py-2 text-base text-ink tabular-nums shadow-xs transition placeholder:text-slate/70 hover:border-slate-300 focus:border-brand-ink focus:outline-hidden focus:ring-3 focus:ring-brand/25 disabled:cursor-not-allowed disabled:border-line disabled:bg-surface disabled:text-slate user-invalid:border-danger motion-reduce:transition-none sm:min-h-10 sm:text-sm";

const labelText = "font-medium text-ink";

export function Field({
  label,
  hint,
  hideLabel = false,
  className = "",
  ...input
}: { label: string; hint?: string; hideLabel?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const hintId = useId();
  return (
    <label className={`flex min-w-0 flex-col gap-2 text-sm ${className}`}>
      <span className={hideLabel ? "sr-only" : labelText}>{label}</span>
      <input aria-describedby={hint ? hintId : undefined} className={control} {...input} />
      {hint ? (
        <span className="text-xs text-slate" id={hintId}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function TextArea({
  label,
  hint,
  className = "",
  ...input
}: { label: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const hintId = useId();
  return (
    <label className={`flex min-w-0 flex-col gap-2 text-sm ${className}`}>
      <span className={labelText}>{label}</span>
      <textarea aria-describedby={hint ? hintId : undefined} className={`${control} py-3`} rows={4} {...input} />
      {hint ? (
        <span className="text-xs text-slate" id={hintId}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/** A search box: the label is read aloud and shown as the placeholder. */
export function SearchField({
  label,
  className = "",
  ...input
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate" />
      <input className={`${control} pl-12`} placeholder={label} type="search" {...input} />
    </label>
  );
}

export function SelectField({
  label,
  hideLabel = false,
  className = "",
  children,
  ...select
}: { label: string; hideLabel?: boolean; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`flex min-w-0 flex-col gap-2 text-sm ${className}`}>
      <span className={hideLabel ? "sr-only" : labelText}>{label}</span>
      <span className="relative block">
        <select className={`${control} cursor-pointer appearance-none pr-12`} {...select}>
          {children}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-slate" />
      </span>
    </label>
  );
}

/** A checkbox on a full-width row, so the whole row is the tap target. */
export function Checkbox({
  label,
  hint,
  className = "",
  ...input
}: { label: string; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label
      className={`-mx-2 flex min-h-12 cursor-pointer items-center gap-2 rounded-button px-2 text-sm text-ink transition-colors hover:bg-surface has-disabled:cursor-not-allowed has-disabled:opacity-60 motion-reduce:transition-none sm:min-h-10 ${className}`}
    >
      <input className={`size-5 shrink-0 cursor-pointer accent-brand-ink ${focusRing}`} type="checkbox" {...input} />
      <span className="min-w-0">
        {label}
        {hint ? <span className="block text-xs text-slate">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Panel({
  title,
  icon,
  actions,
  className = "",
  id,
  children,
}: {
  title?: string;
  /** A small icon in a saffron chip before the title. */
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  id?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  // min-w-0: in a grid, a long product name must not widen the card past the screen
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={`min-w-0 rounded-panel border border-line bg-white p-4 shadow-card sm:p-6 ${className}`}
      id={id}
    >
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h2 className="flex min-w-0 items-center gap-2.5 text-base font-semibold text-ink" id={titleId}>
              {icon ? (
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                  {icon}
                </span>
              ) : null}
              {title}
            </h2>
          ) : null}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "muted" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    ok: "bg-teal-soft text-teal ring-teal/20",
    warn: "bg-brand-soft text-brand-ink ring-brand/35",
    bad: "bg-red-50 text-red-700 ring-red-600/20",
    muted: "bg-slate-100 text-slate-700 ring-slate-500/15",
    info: "bg-navy-soft text-navy ring-navy/15",
  }[tone];
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${styles}`}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current opacity-75" />
      {children}
    </span>
  );
}

/** A message about what just happened: errors are read out at once, the rest when there is a pause. */
export function Alert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-teal/20 bg-teal-soft text-teal",
    info: "border-navy/10 bg-navy-soft text-navy",
  }[tone];
  const Icon = tone === "error" ? AlertIcon : tone === "success" ? CheckCircleIcon : InfoIcon;
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${styles}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** What an empty list says, with the one thing to do next. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-panel border border-dashed border-line bg-white px-6 py-12 text-center">
      {icon ? (
        <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">{icon}</div>
      ) : null}
      <p className="text-base font-semibold text-ink">{title}</p>
      {hint ? <p className="max-w-md text-sm text-slate">{hint}</p> : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** A grey shape where content is about to appear. Callers give it a size and corners. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-slate-200/60 motion-reduce:animate-none ${className}`} />;
}

/** Placeholder rows for a list that is loading. */
export function LoadingRows({ rows = 5, className = "h-16" }: { rows?: number; className?: string }) {
  const t = useTranslations("common");
  return (
    <div className="flex flex-col gap-2" role="status">
      <span className="sr-only">{t("loading")}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton className={`w-full rounded-panel ${className}`} key={index} />
      ))}
    </div>
  );
}

/** A whole page that is loading: a title and a few panels. */
export function PageLoading({ panels = 2 }: { panels?: number }) {
  const t = useTranslations("common");
  return (
    <Page>
      <div className="flex flex-col gap-2" role="status">
        <span className="sr-only">{t("loading")}</span>
        <Skeleton className="h-8 w-48 max-w-full rounded-button" />
        <Skeleton className="h-4 w-72 max-w-full rounded-button" />
      </div>
      {Array.from({ length: panels }, (_, index) => (
        <Skeleton className="h-48 w-full rounded-panel" key={index} />
      ))}
    </Page>
  );
}

/**
 * A destructive button that asks first. The first tap only asks; the question offers Cancel,
 * which has the focus, and the red button that does it.
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  busy = false,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const t = useTranslations("common");
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button onClick={() => setAsking(true)} type="button" variant="danger">
        {label}
      </Button>
    );
  }
  return (
    <div
      aria-label={question}
      className="flex flex-col gap-4 rounded-button border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center"
      role="group"
    >
      <p className="flex-1 text-sm font-medium text-red-800">{question}</p>
      <div className="flex flex-wrap gap-2">
        <Button autoFocus onClick={() => setAsking(false)} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button busy={busy} onClick={onConfirm} type="button" variant="dangerSolid">
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * A dialog for details and short forms: a sheet from the bottom on a phone, a centred card on a
 * wider screen. It is a real modal <dialog> — focus stays inside, Esc and a tap beside it close it.
 */
export function Modal({
  open,
  onClose,
  title,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog?.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className={`m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl border-0 bg-white p-0 text-ink shadow-pop backdrop:bg-[rgb(11_30_67/0.5)] sm:m-auto sm:max-h-[85dvh] sm:rounded-2xl ${
        wide ? "sm:max-w-2xl" : "sm:max-w-lg"
      }`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onClose={onClose}
      ref={ref}
    >
      {open ? (
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line py-2 pr-2 pl-4 sm:pl-6">
            <h2 className="min-w-0 font-display text-lg font-bold text-ink" id={titleId}>
              {title}
            </h2>
            <IconButton label={t("close")} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </div>
          <div className="overflow-y-auto p-4 pb-8 sm:p-6">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

const monogramTints = [
  "bg-brand-soft text-brand-ink",
  "bg-teal-soft text-teal",
  "bg-navy-soft text-navy",
  "bg-[#fdecef] text-[#be123c]",
  "bg-[#e8f0fe] text-sky",
  "bg-[#f1edfe] text-[#6d28d9]",
];

/** Two initials ("Thanaka Face Cream" → "TF"; Burmese: its first letter), for a name that has no picture. */
function initialsOf(name: string) {
  const words = name.split(/[\s·\-–—/,()]+/).filter((word) => /\p{L}/u.test(word));
  const first = (word?: string) => (word ? Array.from(word)[0] : "");
  const latin = /^[A-Za-z]/.test(words[0] ?? "");
  return (latin ? `${first(words[0])}${first(words[1])}` : first(words[0])).toUpperCase() || "?";
}

/** A product's stand-in picture: its initials on a tint that is always the same for the same name. */
export function Monogram({ name, className = "size-10 rounded-xl text-sm" }: { name: string; className?: string }) {
  const tint = monogramTints[Array.from(name).reduce((sum, char) => sum + char.codePointAt(0)!, 0) % monogramTints.length];
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center font-display font-bold ${tint} ${className}`}>
      {initialsOf(name)}
    </span>
  );
}

/** Label and value on one line, for the figures in a detail view. */
export function Figure({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-slate">{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "text-base font-semibold text-ink" : "text-sm text-ink"}`}>{value}</dd>
    </div>
  );
}

export function Soon({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shell");
  return (
    <span className="text-xs text-slate" title={t("comingSoon")}>
      {children} · {t("comingSoon")}
    </span>
  );
}
