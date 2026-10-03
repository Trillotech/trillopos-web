"use client";

import { useEffect, useId, useRef, useState } from "react";
import Decimal from "decimal.js";
import { useLocale, useTranslations } from "next-intl";

import {
  ArrowRightIcon,
  BankIcon,
  BanknoteIcon,
  CartIcon,
  MinusIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
  UserPlusIcon,
  WalletIcon,
} from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  buttonClasses,
  Field,
  focusRing,
  IconButton,
  insetFocusRing,
  LoadingRows,
  Modal,
  Monogram,
  Page,
  PageHeader,
  SearchField,
  SelectField,
} from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { markJustSold } from "@/lib/just-sold";
import { formatAmount, formatQuantity } from "@/lib/money";
import { ApiError, messageFor, readJson } from "@/lib/read-json";
import { useMembershipRole } from "@/lib/role";
import { matchesWords } from "@/lib/search";

type Product = Schemas["ProductView"];
type Location = Schemas["LocationView"];
type Shift = Schemas["ShiftView"];
type Customer = Schemas["CustomerView"];
type Category = Schemas["CategoryView"];
type Balance = Schemas["BalanceView"];
type Method = Schemas["PaymentRequest"]["method"];

type Line = { productId: string; name: string; quantity: string };
/** In the shop: a register shift and its drawer. Online: an order from Facebook, Viber or the phone — no shift. */
type Mode = "STORE" | "ONLINE";
type Tender = { method: Method; amount: string; reference: string };
type Plan = "PAID" | "DEPOSIT" | "UNPAID";
/** Which request is in flight, so its button spins and the others wait. */
type Busy = "charge" | "hold" | "shift" | "customer" | "search";
/** Where an error is shown: next to the thing that failed. */
type ErrorAt = "shift" | "customer" | "cart";

const cashMethods = ["CASH", "KBZ_PAY", "WAVE_PAY", "AYA_PAY", "CB_PAY", "BANK_TRANSFER", "OTHER"] as const;
const plans: Plan[] = ["PAID", "DEPOSIT", "UNPAID"];
/** Enough tiles to browse by eye; the search finds the rest. */
const tileLimit = 120;
/**
 * On a phone the bars float clear of the tab bar and its raised Sell button (it rises 1.75rem);
 * beside the sidebar they float at the foot of the page; on a laptop the cart's own footer is enough.
 */
const floating =
  "fixed inset-x-4 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-20 rounded-2xl border border-line bg-white/95 p-2 shadow-pop backdrop-blur md:right-8 md:bottom-6 md:left-[calc(16rem+2rem)]";

/** A typed amount as a number, or nothing while it is not one yet. */
function parse(text: string) {
  const trimmed = text.trim();
  return /^\d+(\.\d+)?$/.test(trimmed) ? new Decimal(trimmed) : undefined;
}

function nonZero(value?: number | string) {
  return value != null && !new Decimal(value).isZero();
}

/** What a customer is likely to hand over: the exact total, then the next round notes (Kyat: 1,000 / 5,000 / 10,000). */
function quickAmounts(total: Decimal, currency: string) {
  if (total.lte(0)) {
    return [];
  }
  const steps = currency === "THB" ? [100, 500, 1000] : [1000, 5000, 10000];
  const biggest = steps[steps.length - 1];
  const candidates = [
    total,
    ...steps.map((step) => total.div(step).ceil().times(step)),
    total.div(biggest).ceil().plus(1).times(biggest),
  ];
  const unique: Decimal[] = [];
  for (const amount of candidates) {
    if (!unique.some((seen) => seen.eq(amount))) {
      unique.push(amount);
    }
  }
  return unique.sort((a, b) => a.comparedTo(b)).slice(0, 4);
}

function MethodIcon({ method, className }: { method: Method; className?: string }) {
  const Icon = method === "CASH" ? BanknoteIcon : method === "BANK_TRANSFER" ? BankIcon : method === "OTHER" ? WalletIcon : PhoneIcon;
  return <Icon className={className} />;
}

/** The ways money arrives, as big buttons: one tap, no list to open. */
function MethodPicker({ label, value, onChange }: { label: string; value: Method; onChange: (method: Method) => void }) {
  const codes = useCodes();
  return (
    <div aria-label={label} className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4" role="radiogroup">
      {cashMethods.map((method) => {
        const checked = value === method;
        return (
          <button
            aria-checked={checked}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-center text-xs leading-tight font-semibold lg:min-h-14 transition-colors motion-reduce:transition-none ${focusRing} ${
              checked ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-slate-300 hover:bg-surface"
            }`}
            key={method}
            onClick={() => onChange(method)}
            role="radio"
            type="button"
          >
            <MethodIcon className={`size-5 shrink-0 ${checked ? "text-brand" : "text-slate"}`} method={method} />
            <span className="line-clamp-2 max-w-full break-words">{codes("method", method)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SaleDesk() {
  const { locationId: scope, register } = useMembershipRole();
  const t = useTranslations("sale");
  const errors = useTranslations("errors");
  const codes = useCodes();
  const locale = useLocale();
  const router = useRouter();
  const cartTitle = useId();
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [balances, setBalances] = useState<Balance[]>();
  const [currency, setCurrency] = useState("");
  // a shop that may sell below zero is never warned about stock
  const [negativeStock, setNegativeStock] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [shift, setShift] = useState<Shift>();
  const [shiftFor, setShiftFor] = useState<string>();
  const [drawer, setDrawer] = useState<Schemas["Drawer"]>();
  const [floatAmount, setFloatAmount] = useState("0");
  const [counted, setCounted] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [cartDiscount, setCartDiscount] = useState("");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [tenders, setTenders] = useState<Tender[]>([{ method: "CASH", amount: "", reference: "" }]);
  const [paymentPlan, setPaymentPlan] = useState<Plan>("PAID");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<Method>("KBZ_PAY");
  const [depositReference, setDepositReference] = useState("");
  const [priceChoice, setPriceChoice] = useState<"" | "RETAIL" | "WHOLESALE">("RETAIL");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searched, setSearched] = useState(false);
  const [customer, setCustomer] = useState<Customer>();
  const [choosingCustomer, setChoosingCustomer] = useState(false);
  const [closing, setClosing] = useState(false);
  // below a laptop the cart is a view of its own: the products first, then the cart and the payment
  const [view, setView] = useState<"items" | "cart">("items");
  const [error, setError] = useState<string>();
  const [errorAt, setErrorAt] = useState<ErrorAt>("cart");
  const [busy, setBusy] = useState<Busy>();
  const [key] = useState(() => crypto.randomUUID());
  const [mode, setMode] = useState<Mode>("STORE");
  // a kind of sale the person picked themselves is kept when the shop's default arrives late
  const pickedMode = useRef(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const stores = locations.filter((row) => row.type === "STORE" && row.active !== false);
  // the shift answer for the store now picked has arrived, open or not
  const shiftKnown = shiftFor === locationId;

  useEffect(() => {
    void readJson<Location[]>("/api/org/locations").then((rows) => {
      const allowed = rows.filter(row => !scope || row.id === scope);
      setLocations(allowed);
      const store = allowed.find((row) => row.type === "STORE" && row.active !== false);
      if (store?.id) {
        setLocationId(store.id);
      }
    });
    void readJson<Product[]>("/api/catalog/products").then((rows) => {
      setProducts(rows);
      setProductsLoaded(true);
    });
    // the chips and the stock on the tiles are a help, not a need: the screen sells without them
    void readJson<Category[]>("/api/catalog/categories").then(setCategories).catch(() => undefined);
    void readJson<Balance[]>("/api/catalog/balances").then(setBalances).catch(() => undefined);
    void readJson<Schemas["OrganizationView"]>("/api/catalog/organization").then((org) => {
      setCurrency(org.currencyCode ?? "");
      setNegativeStock(org.allowNegativeStock === true);
      if (org.businessType === "ONLINE" && !register && !pickedMode.current) {
        chooseMode("ONLINE");
      }
    });
  }, [scope, register]);

  useEffect(() => {
    if (!locationId) {
      return;
    }
    void readJson<Shift | null>(`/api/sales/shifts?locationId=${locationId}`)
      .then((open) => setShift(open ?? undefined))
      .catch(() => {
        setShift(undefined);
        setDrawer(undefined);
      })
      .finally(() => setShiftFor(locationId));
  }, [locationId]);

  useEffect(() => {
    if (!shift?.id || shift.status !== "OPEN") {
      return;
    }
    void readJson<Schemas["Drawer"]>(`/api/sales/shifts/${shift.id}/drawer`).then(setDrawer);
  }, [shift?.id, shift?.status]);

  // the products for this kind of sale, then the search (name, SKU, sizes or barcode), then the category
  const listed = products.filter((product) =>
    product.active !== false && (mode === "ONLINE" ? product.sellOnline === true : product.sellInPos !== false));
  const needle = query.trim().toLowerCase();
  const matching = listed.filter((product) =>
    !needle || matchesWords(needle, product.name, product.sku, product.sizeEquivalents, product.barcodes?.join(" ")));
  const counts = new Map<string, number>();
  for (const product of matching) {
    if (product.categoryId) {
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }
  }
  const activeCategory = category && counts.has(category) ? category : "";
  const visible = matching.filter((product) => !activeCategory || product.categoryId === activeCategory);
  const chips = categories
    .filter((row) => row.id && counts.has(row.id))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  const stock = new Map((balances ?? []).filter((row) => row.locationId === locationId).map((row) => [row.productId, new Decimal(row.quantity ?? 0)]));
  const inCart = new Map(lines.map((line) => [line.productId, line.quantity]));
  const productById = new Map(products.map((product) => [product.id, product]));
  /** On hand at the chosen store, or nothing when the product is not counted (or stock is unknown). */
  const leftOf = (productId?: string) =>
    productById.get(productId)?.trackInventory === false || !balances ? undefined : stock.get(productId) ?? new Decimal(0);
  const shortOf = (line: Line) => {
    const left = leftOf(line.productId);
    const quantity = parse(line.quantity);
    return !negativeStock && left !== undefined && quantity !== undefined && quantity.gt(left) ? left : undefined;
  };
  const priceType = priceChoice || customer?.defaultPriceType || "RETAIL";
  const priceOf = (product: Product) =>
    priceType === "WHOLESALE" && product.wholesalePrice != null ? product.wholesalePrice : product.retailPrice;

  function fail(at: ErrorAt, caught: unknown) {
    setErrorAt(at);
    setError(messageFor(caught, errors, (code) => errors.has(code)));
  }

  function add(product: Product) {
    if (!product.id) {
      return;
    }
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        // a quantity half typed ("2a") counts as none, rather than stopping the till
        return current.map((line) => line.productId === product.id
          ? { ...line, quantity: (parse(line.quantity) ?? new Decimal(0)).plus(1).toString() } : line);
      }
      return [...current, { productId: product.id!, name: product.name ?? "", quantity: "1" }];
    });
  }

  /** A scanner types the barcode and presses Enter: add that product (or the only match) and clear for the next. */
  function addFromSearch() {
    const code = query.trim();
    if (!code) {
      return;
    }
    const exact = listed.find((product) => product.barcodes?.includes(code) || product.sku?.toLowerCase() === code.toLowerCase());
    const pick = exact ?? (visible.length === 1 ? visible[0] : undefined);
    if (pick) {
      add(pick);
      setQuery("");
    }
  }

  function step(productId: string, delta: 1 | -1) {
    setLines((current) => current.flatMap((line) => {
      if (line.productId !== productId) {
        return [line];
      }
      const next = (parse(line.quantity) ?? new Decimal(0)).plus(delta);
      return next.lte(0) ? [] : [{ ...line, quantity: next.toString() }];
    }));
  }

  function clearCart() {
    setLines([]);
    setCartDiscount("");
    setDiscountOpen(false);
    setError(undefined);
    setView("items");
  }

  function setTender(index: number, patch: Partial<Tender>) {
    setTenders((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  const cartRequest = JSON.stringify({
      locationId,
      channel: mode === "ONLINE" ? "ONLINE" : "POS",
      cashierShiftId: mode === "STORE" ? shift?.id : undefined,
      customerId: customer?.id,
      priceType: priceChoice || undefined,
      cartDiscountAmount: cartDiscount || undefined,
      lines: lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      })),
  });
  const [quoteRevision, setQuoteRevision] = useState(0);
  const [quote, setQuote] = useState<{ request: string; revision: number; data?: Schemas["PricePreview"]; error?: string }>();
  const canPrice = lines.length > 0 && Boolean(locationId);
  const currentQuote = quote?.request === cartRequest && quote.revision === quoteRevision ? quote : undefined;
  const preview = currentQuote?.data;
  useEffect(() => {
    if (!canPrice) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void readJson<Schemas["PricePreview"]>("/api/sales/preview", {
        method: "POST", body: cartRequest, signal: controller.signal,
      }).then((data) => {
        if (!controller.signal.aborted) setQuote({ request: cartRequest, revision: quoteRevision, data });
      }).catch((caught) => {
        if (!controller.signal.aborted) setQuote({ request: cartRequest, revision: quoteRevision,
          error: messageFor(caught, (code) => errors(code), errors.has) });
      });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [cartRequest, canPrice, quoteRevision, errors]);

  const total = preview?.totals?.total != null ? new Decimal(preview.totals.total) : undefined;
  const single = tenders.length === 1 ? tenders[0] : undefined;
  const cashGiven = single?.method === "CASH" ? parse(single.amount) : undefined;
  const change = total && cashGiven ? cashGiven.minus(total) : undefined;

  // what Charge was pressed for: once the cart or the payment changes, its error is old news
  const attempt = JSON.stringify([cartRequest, paymentPlan, tenders, depositAmount, depositMethod, depositReference]);
  const [triedFor, setTriedFor] = useState<string>();

  function cartBody() {
    return { ...JSON.parse(cartRequest), pricingFingerprint: preview?.pricingFingerprint };
  }

  function payments() {
    if (paymentPlan === "UNPAID") return [{ method: "CREDIT" }];
    if (paymentPlan === "DEPOSIT") {
      const whole = new Decimal(preview?.totals?.total ?? 0);
      const deposit = new Decimal(depositAmount || 0);
      return [{ method: depositMethod, amount: deposit.toString(), referenceNo: depositReference || undefined },
        { method: "CREDIT", amount: whole.minus(deposit).toString() }];
    }
    // the only payment, left empty (or cash handed over): the backend takes the whole total
    const whole = tenders.length === 1;
    return tenders.map((tender) => ({
      method: tender.method,
      amount: whole && (!tender.amount || tender.method === "CASH") ? undefined : tender.amount || "0",
      tenderedAmount: tender.method === "CASH" ? tender.amount || undefined : undefined,
      referenceNo: tender.reference || undefined,
    }));
  }

  async function checkout() {
    if (!preview) return;
    setError(undefined);
    setErrorAt("cart");
    setTriedFor(attempt);
    if (mode === "STORE" && !shift?.id) {
      setError(t("needShift"));
      return;
    }
    if ((paymentPlan !== "PAID" || tenders.some((tender) => tender.method === "CREDIT")) && !customer) {
      setError(errors("customer_required"));
      return;
    }
    if (paymentPlan === "DEPOSIT") {
      try {
        const deposit = new Decimal(depositAmount || 0);
        if (!deposit.isFinite() || deposit.lte(0) || deposit.gte(preview.totals?.total ?? 0) || deposit.decimalPlaces() > 2) throw new Error("invalid");
      } catch { setError(t("invalidDeposit")); return; }
    }
    if (paymentPlan === "PAID" && change?.lt(0)) {
      setError(t("short", { amount: formatAmount(change.neg().toString()) }));
      return;
    }
    setBusy("charge");
    try {
      const sale = await readJson<Schemas["SaleView"]>("/api/sales/checkout", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: key, ...cartBody(), payments: payments() }),
      });
      markJustSold(sale.id ?? "");
      router.push(`/sales/${sale.id}`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "insufficient_stock") {
        // the server's own words name products by id: say which ones, and show the stock as it is now
        const short = lines.filter((line) => shortOf(line) !== undefined).map((line) => line.name);
        setError(short.length ? t("notEnoughStock", { names: short.join(", ") }) : errors("insufficient_stock"));
        void readJson<Balance[]>("/api/catalog/balances").then(setBalances).catch(() => undefined);
      } else {
        fail("cart", caught);
      }
      if (caught instanceof ApiError && caught.code === "pricing_changed") setQuoteRevision((value) => value + 1);
      setBusy(undefined);
    }
  }

  async function hold() {
    if (!preview) return;
    setError(undefined);
    setTriedFor(attempt);
    setBusy("hold");
    try {
      const parked = await readJson<Schemas["SaleView"]>("/api/sales", {
        method: "POST",
        body: JSON.stringify({ ...cartBody(), hold: true }),
      });
      router.push(`/sales/${parked.id}`);
    } catch (caught) {
      fail("cart", caught);
      if (caught instanceof ApiError && caught.code === "pricing_changed") setQuoteRevision((value) => value + 1);
      setBusy(undefined);
    }
  }

  async function openShift(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy("shift");
    try {
      const opened = await readJson<Shift>("/api/sales/shifts", {
        method: "POST",
        body: JSON.stringify({ locationId, openingFloat: floatAmount || "0" }),
      });
      setShift(opened);
    } catch (caught) {
      fail("shift", caught);
    } finally {
      setBusy(undefined);
    }
  }

  async function closeShift(event: React.FormEvent) {
    event.preventDefault();
    if (!shift?.id) {
      return;
    }
    setError(undefined);
    setBusy("shift");
    try {
      await readJson(`/api/sales/shifts/${shift.id}/close`, {
        method: "POST",
        body: JSON.stringify({ countedCash: counted || "0" }),
      });
      setShift(undefined);
      setDrawer(undefined);
      setCounted("");
      setClosing(false);
    } catch (caught) {
      fail("shift", caught);
    } finally {
      setBusy(undefined);
    }
  }

  function chooseMode(next: Mode) {
    setMode(next);
    // an online order is usually paid by wallet (or on delivery); a shop sale usually in cash
    setTenders([{ method: next === "ONLINE" ? "KBZ_PAY" : "CASH", amount: "", reference: "" }]);
  }

  async function searchCustomers(event: React.FormEvent) {
    event.preventDefault();
    const search = new URLSearchParams();
    if (customerQuery.trim()) {
      search.set("q", customerQuery.trim());
    }
    setBusy("search");
    try {
      setCustomers(await readJson<Customer[]>(`/api/customers?${search}`));
      setSearched(true);
    } catch (caught) {
      fail("customer", caught);
    } finally {
      setBusy(undefined);
    }
  }

  async function createCustomer(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy("customer");
    try {
      const created = await readJson<Customer>("/api/customers", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim() || undefined }),
      });
      setNewName("");
      setNewPhone("");
      chooseCustomer(created);
    } catch (caught) {
      fail("customer", caught);
    } finally {
      setBusy(undefined);
    }
  }

  function chooseCustomer(next: Customer) {
    setCustomer(next);
    setPriceChoice("");
    setCustomers([]);
    setSearched(false);
    setChoosingCustomer(false);
  }

  function walkIn() {
    setCustomer(undefined);
    setPaymentPlan("PAID");
    setPriceChoice("RETAIL");
    setTenders((current) => current.map((row) => row.method === "CREDIT" ? { ...row, method: "CASH" } : row));
  }

  function openCart() {
    setView("cart");
    window.scrollTo({ top: 0 });
  }

  const found = customers.filter((row) => !row.archived);
  const storeSelect = (
    <SelectField
      className="sm:w-56"
      label={mode === "ONLINE" ? t("shipFrom") : t("store")}
      onChange={(event) => setLocationId(event.target.value)}
      value={locationId}
    >
      {stores.map((row) => (
        <option key={row.id} value={row.id}>{row.name}</option>
      ))}
    </SelectField>
  );
  const since = shift?.openedAt
    ? new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(shift.openedAt))
    : "";
  const ready = Boolean(preview) && lines.length > 0;

  return (
    <Page className="pb-28 lg:pb-8">
      <PageHeader
        actions={
          <div
            aria-label={t("modeLabel")}
            className="grid w-full grid-cols-2 gap-1 rounded-xl border border-line bg-white p-1 shadow-xs sm:w-auto"
            role="radiogroup"
          >
            {(["STORE", "ONLINE"] as const).map((value) => (
              <button
                aria-checked={mode === value}
                className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors motion-reduce:transition-none ${focusRing} ${
                  mode === value ? "bg-navy text-white shadow-xs" : "text-slate hover:bg-surface hover:text-ink"
                }`}
                key={value}
                onClick={() => {
                  pickedMode.current = true;
                  chooseMode(value);
                }}
                role="radio"
                type="button"
              >
                {value === "STORE" ? t("modeStore") : t("modeOnline")}
              </button>
            ))}
          </div>
        }
        subtitle={t("subtitle")}
        title={t("title")}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
        {/* the products: where the sale happens, then the search, the categories and the tiles */}
        <div className={`${view === "cart" ? "hidden lg:flex" : "flex"} min-w-0 flex-col gap-4`}>
          {mode === "STORE" ? (
            <div className="flex flex-col gap-3 rounded-panel border border-line bg-white p-3 shadow-card sm:flex-row sm:items-end sm:p-4">
              {storeSelect}
              {!shiftKnown ? (
                <LoadingRows className="h-10 flex-1" rows={1} />
              ) : shift?.status === "OPEN" ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 sm:min-h-10">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span aria-hidden="true" className="size-2 rounded-full bg-teal" />
                    <span className="font-semibold text-ink">{t("shift")}: {t("shiftOpen")}</span>
                    {since ? <span className="text-slate">{t("shiftSince", { time: since })}</span> : null}
                  </p>
                  <Button onClick={() => setClosing(true)} type="button" variant="secondary">{t("closeShift")}</Button>
                </div>
              ) : (
                <form className="flex min-w-0 flex-1 flex-wrap items-end gap-2" onSubmit={(event) => void openShift(event)}>
                  <Field className="w-36" inputMode="decimal" label={t("float")} onChange={(event) => setFloatAmount(event.target.value)} value={floatAmount} />
                  <Button busy={busy === "shift"} disabled={!locationId} type="submit">{t("openShift")}</Button>
                  <p className="w-full text-sm font-medium text-brand-ink">{t("needShift")}</p>
                </form>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {storeSelect}
              <Alert tone="info">{t("onlineHint")}</Alert>
            </div>
          )}
          {error && errorAt === "shift" && !closing ? <Alert>{error}</Alert> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
            <SearchField
              className="flex-1"
              label={t("search")}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addFromSearch();
                }
              }}
              title={t("scanHint")}
              value={query}
            />
            {/* the price list in use; a chosen customer brings their own until one is tapped */}
            <div
              aria-label={t("priceType")}
              className="grid shrink-0 grid-cols-2 gap-1 rounded-xl border border-line bg-white p-1 shadow-xs sm:w-56 lg:w-full xl:w-56"
              role="radiogroup"
            >
              {(["RETAIL", "WHOLESALE"] as const).map((value) => (
                <button
                  aria-checked={priceType === value}
                  className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors motion-reduce:transition-none sm:min-h-8 ${focusRing} ${
                    priceType === value ? "bg-navy text-white shadow-xs" : "text-slate hover:bg-surface hover:text-ink"
                  }`}
                  key={value}
                  onClick={() => setPriceChoice(value)}
                  role="radio"
                  type="button"
                >
                  {codes("priceType", value)}
                </button>
              ))}
            </div>
          </div>
          {customer && priceChoice === "" ? <p className="-mt-1 text-sm text-slate">{t("priceFromCustomer")}</p> : null}

          {chips.length > 0 ? (
            <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0">
              <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
                {[{ id: "", name: t("allCategories"), count: matching.length }, ...chips.map((row) => ({ id: row.id!, name: row.name ?? "", count: counts.get(row.id!) ?? 0 }))].map((chip) => {
                  const on = activeCategory === chip.id;
                  return (
                    <button
                      aria-pressed={on}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none sm:min-h-9 ${focusRing} ${
                        on ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-slate-300"
                      }`}
                      key={chip.id || "all"}
                      onClick={() => setCategory(chip.id)}
                      type="button"
                    >
                      {chip.name}
                      <span className={`text-xs tabular-nums ${on ? "text-white/70" : "text-slate"}`}>{chip.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!productsLoaded ? (
            <LoadingRows className="h-40" rows={2} />
          ) : visible.length === 0 ? (
            <p className="rounded-panel border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-slate">
              {query.trim() ? t("noMatch", { query: query.trim() }) : mode === "ONLINE" ? t("noOnlineProducts") : t("noProducts")}
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visible.slice(0, tileLimit).map((product) => {
                  const quantity = product.id ? inCart.get(product.id) : undefined;
                  const left = leftOf(product.id);
                  const offer = product.discount;
                  const discount = offer?.type && offer.enabled !== false && (priceType !== "WHOLESALE" || offer.includeWholesale)
                    ? offer.type === "PERCENT" ? `−${formatQuantity(offer.value)}%` : `−${formatAmount(offer.value)}`
                    : undefined;
                  return (
                    <li key={product.id}>
                      <button
                        className={`relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-card transition motion-reduce:transition-none not-disabled:active:scale-[0.98] ${focusRing} ${
                          quantity ? "border-brand ring-1 ring-brand" : "border-line hover:border-slate-300 hover:shadow-pop"
                        }`}
                        onClick={() => add(product)}
                        type="button"
                      >
                        <span className="relative block">
                          <Monogram className="h-16 w-full text-xl" name={product.name ?? ""} />
                          {discount ? (
                            <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[0.6875rem] font-bold text-brand-ink shadow-xs">
                              {discount}
                            </span>
                          ) : null}
                          {quantity ? (
                            <span className="absolute top-2 right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-navy px-1.5 text-xs font-bold text-white shadow-xs tabular-nums">
                              {parse(quantity) ? formatQuantity(quantity) : quantity}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex flex-1 flex-col gap-1 p-3">
                          <span className="line-clamp-2 text-sm leading-snug font-semibold break-words text-ink">{product.name}</span>
                          {product.sizeEquivalents ? <span className="truncate text-xs text-slate">{product.sizeEquivalents}</span> : null}
                          <span className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 pt-1">
                            <span className="font-semibold text-ink tabular-nums">{formatAmount(priceOf(product))}</span>
                            {left === undefined ? null : left.lte(0) ? (
                              <span className="text-xs font-semibold text-danger">{t("outOfStock")}</span>
                            ) : (
                              <span className={`text-xs tabular-nums ${left.lte(product.reorderPoint ?? 0) ? "font-semibold text-brand-ink" : "text-slate"}`}>
                                {t("left", { quantity: formatQuantity(left.toString()) })}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {visible.length > tileLimit ? <p className="text-xs text-slate">{t("moreResults", { count: tileLimit })}</p> : null}
            </>
          )}
        </div>

        {/* the cart: a receipt being written, with the payment and the one action the screen exists for */}
        <section
          aria-labelledby={cartTitle}
          className={`${view === "items" ? "hidden lg:flex" : "flex"} min-w-0 flex-col rounded-panel border border-line bg-white shadow-card lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]`}
          id="cart"
        >
          <div className="flex flex-col gap-2 border-b border-dashed border-slate-300 px-4 py-3 sm:px-5">
            <button
              className={`inline-flex items-center gap-1.5 self-start rounded-button py-1 text-sm font-semibold text-brand-ink lg:hidden ${focusRing}`}
              onClick={() => setView("items")}
              type="button"
            >
              <ArrowRightIcon className="size-4 rotate-180" />
              {t("backToItems")}
            </button>
            <div className="flex min-h-8 items-center gap-2">
              <h2 className="font-display text-lg font-bold text-ink" id={cartTitle}>{t("cart")}</h2>
              {lines.length > 0 ? <Badge tone="info">{t("cartCount", { count: lines.length })}</Badge> : null}
              {lines.length > 0 ? (
                <button className={`ml-auto rounded-sm text-sm font-semibold text-danger hover:underline ${focusRing}`} onClick={clearCart} type="button">
                  {t("clearCart")}
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-5 px-4 py-4 sm:px-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {customer ? (
              <div className="rounded-xl bg-surface p-3">
                <div className="flex items-start gap-3">
                  <Monogram className="size-10 rounded-full text-sm" name={customer.name ?? ""} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{customer.name}</p>
                    {customer.phone ? <p className="text-xs text-slate tabular-nums">{customer.phone}</p> : null}
                    <p className="mt-1 text-xs text-slate">
                      {t("outstanding")} <span className="font-semibold text-ink tabular-nums">{formatAmount(customer.outstanding)}</span>
                      {" · "}
                      {t("available")} <span className="font-semibold text-ink tabular-nums">{formatAmount(customer.availableCredit)}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button onClick={() => setChoosingCustomer(true)} type="button" variant="secondary">{t("changeCustomer")}</Button>
                  <Button onClick={walkIn} type="button" variant="secondary">{t("walkIn")}</Button>
                </div>
              </div>
            ) : (
              <button
                className={`flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2.5 text-left transition-colors hover:border-brand hover:bg-brand-soft/40 motion-reduce:transition-none ${focusRing}`}
                onClick={() => setChoosingCustomer(true)}
                type="button"
              >
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-slate">
                  <UserPlusIcon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{t("walkInCustomer")}</span>
                  <span className="block text-xs font-semibold text-brand-ink">{t("chooseCustomer")}</span>
                </span>
              </button>
            )}

            {lines.length === 0 ? (
              <p className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-slate">
                <CartIcon className="size-7 text-slate/70" />
                {t("cartEmpty")}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-dashed divide-line">
                {lines.map((line, index) => {
                  const priced = preview?.lines?.[index];
                  const nameId = `${cartTitle}-line-${index}`;
                  const short = shortOf(line);
                  return (
                    <li className="flex gap-3 py-3 first:pt-0" key={line.productId}>
                      <Monogram className="size-10 rounded-lg text-xs" name={line.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <p className="min-w-0 pt-0.5 text-sm leading-snug font-semibold break-words text-ink" id={nameId}>{line.name}</p>
                          <IconButton
                            className="-mt-1.5 -mr-2"
                            label={t("removeLine", { name: line.name })}
                            onClick={() => setLines((current) => current.filter((row) => row.productId !== line.productId))}
                            tone="danger"
                          >
                            <TrashIcon className="size-4" />
                          </IconButton>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <div className="flex items-center rounded-full border border-line bg-white">
                            <button
                              aria-label={t("decrease", { name: line.name })}
                              className={`flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface motion-reduce:transition-none sm:size-9 ${focusRing}`}
                              onClick={() => step(line.productId, -1)}
                              type="button"
                            >
                              <MinusIcon className="size-4" />
                            </button>
                            <input
                              aria-describedby={nameId}
                              aria-label={t("qty")}
                              className="w-12 bg-transparent text-center text-sm font-semibold text-ink tabular-nums outline-hidden focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-brand-ink"
                              inputMode="decimal"
                              onChange={(event) => setLines((current) => current.map((row) => row.productId === line.productId ? { ...row, quantity: event.target.value } : row))}
                              value={line.quantity}
                            />
                            <button
                              aria-label={t("increase", { name: line.name })}
                              className={`flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface motion-reduce:transition-none sm:size-9 ${focusRing}`}
                              onClick={() => step(line.productId, 1)}
                              type="button"
                            >
                              <PlusIcon className="size-4" />
                            </button>
                          </div>
                          <div className="min-w-0 text-right tabular-nums">
                            <p className="font-mono text-sm font-semibold text-ink">{priced ? formatAmount(priced.lineTotal) : "…"}</p>
                            {priced ? <p className="text-xs text-slate">{formatQuantity(priced.quantity)} × {formatAmount(priced.unitPrice)}</p> : null}
                          </div>
                        </div>
                        {priced && nonZero(priced.discountAmount) ? (
                          <p className="mt-1 text-xs font-semibold text-teal">{t("automaticSaving")}: −{formatAmount(priced.discountAmount)}</p>
                        ) : null}
                        {short === undefined ? null : (
                          <p className="mt-1 text-xs font-semibold text-danger">
                            {short.lte(0) ? t("outOfStock") : t("onlyLeft", { quantity: formatQuantity(short.toString()) })}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {lines.length > 0 ? (
              discountOpen || cartDiscount ? (
                <Field autoFocus={discountOpen && !cartDiscount} inputMode="decimal" label={t("cartDiscount")} onChange={(event) => setCartDiscount(event.target.value)} value={cartDiscount} />
              ) : (
                <button className={`inline-flex items-center gap-1.5 self-start rounded-sm text-sm font-semibold text-brand-ink hover:underline ${focusRing}`} onClick={() => setDiscountOpen(true)} type="button">
                  <PlusIcon className="size-4" />
                  {t("addDiscount")}
                </button>
              )
            ) : null}

            {lines.length > 0 ? (
              <div aria-live="polite" className="rounded-xl bg-surface px-4 py-3">
                {preview ? (
                  <dl className="flex flex-col gap-1.5 text-sm" data-testid="sale-preview">
                    <Total label={t("subtotal")} value={formatAmount(preview.totals?.subtotal)} />
                    {nonZero(preview.totals?.lineDiscountTotal) ? <Total label={t("automaticSaving")} value={`−${formatAmount(preview.totals?.lineDiscountTotal)}`} /> : null}
                    {nonZero(preview.totals?.cartDiscountAmount) ? <Total label={t("cartDiscount")} value={`−${formatAmount(preview.totals?.cartDiscountAmount)}`} /> : null}
                    {nonZero(preview.totals?.taxAmount) ? <Total label={t("tax")} value={formatAmount(preview.totals?.taxAmount)} /> : null}
                    {nonZero(preview.totals?.roundingAdjustment) ? <Total label={t("rounding")} value={formatAmount(preview.totals?.roundingAdjustment)} /> : null}
                    <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-dashed border-slate-300 pt-2">
                      <dt className="font-semibold text-ink">{t("total")}</dt>
                      <dd className="font-display text-2xl leading-tight font-bold text-ink tabular-nums">
                        {formatAmount(preview.totals?.total)} <span className="font-sans text-xs font-semibold text-slate">{currency}</span>
                      </dd>
                    </div>
                  </dl>
                ) : currentQuote?.error ? (
                  <div className="flex flex-col items-start gap-2">
                    <Alert>{currentQuote.error}</Alert>
                    <Button onClick={() => setQuoteRevision((value) => value + 1)} type="button" variant="ghost">{t("retryPrice")}</Button>
                  </div>
                ) : (
                  <p className="text-sm text-slate">{t("pricing")}</p>
                )}
              </div>
            ) : null}

            {lines.length > 0 ? (
              <div className="flex flex-col gap-4 border-t border-dashed border-slate-300 pt-4">
                <h3 className="text-sm font-semibold text-ink">{t("paymentTitle")}</h3>
                <div aria-label={t("paymentPlan")} className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1" role="radiogroup">
                  {plans.map((value) => (
                    <button
                      aria-checked={paymentPlan === value}
                      className={`min-h-10 rounded-lg px-2 text-sm font-semibold transition-colors motion-reduce:transition-none ${focusRing} ${
                        paymentPlan === value ? "bg-white text-ink shadow-xs" : "text-slate hover:text-ink"
                      }`}
                      key={value}
                      onClick={() => setPaymentPlan(value)}
                      role="radio"
                      type="button"
                    >
                      {codes("salePayment", value)}
                    </button>
                  ))}
                </div>

                {paymentPlan === "PAID" && single ? (
                  <>
                    <MethodPicker label={t("method")} onChange={(method) => setTenders([{ method, amount: "", reference: "" }])} value={single.method} />
                    {single.method === "CASH" ? (
                      <div className="flex flex-col gap-3">
                        <Field inputMode="decimal" label={t("tendered")} onChange={(event) => setTender(0, { amount: event.target.value })} value={single.amount} />
                        {total ? (
                          <div aria-label={t("quickCash")} className="flex flex-wrap gap-2" role="group">
                            {quickAmounts(total, currency).map((amount) => (
                              <button
                                aria-pressed={cashGiven?.eq(amount) ?? false}
                                className={`min-h-10 rounded-full border px-3.5 text-sm font-semibold tabular-nums transition-colors motion-reduce:transition-none sm:min-h-9 ${focusRing} ${
                                  cashGiven?.eq(amount) ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-slate-300"
                                }`}
                                key={amount.toString()}
                                onClick={() => setTender(0, { amount: amount.toString() })}
                                type="button"
                              >
                                {amount.eq(total) ? t("exact") : formatAmount(amount.toString())}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {change ? (
                          change.gte(0) ? (
                            <p aria-live="polite" className="flex items-center justify-between gap-3 rounded-xl bg-teal-soft px-4 py-2.5 text-teal">
                              <span className="text-sm font-semibold">{t("changeDue")}</span>
                              <span className="font-display text-2xl leading-tight font-bold tabular-nums">{formatAmount(change.toString())}</span>
                            </p>
                          ) : (
                            <p aria-live="polite" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
                              {t("short", { amount: formatAmount(change.neg().toString()) })}
                            </p>
                          )
                        ) : (
                          <p className="text-xs text-slate">{t("amountHint")}</p>
                        )}
                      </div>
                    ) : (
                      <Field label={t("reference")} maxLength={100} onChange={(event) => setTender(0, { reference: event.target.value })} value={single.reference} />
                    )}
                  </>
                ) : null}

                {paymentPlan === "PAID" && !single ? (
                  <div className="flex flex-col gap-3">
                    {tenders.map((tender, index) => (
                      <div className="flex flex-col gap-2 rounded-xl border border-line p-3" key={index}>
                        <div className="flex items-end gap-2">
                          <SelectField
                            className="flex-1"
                            label={t("method")}
                            onChange={(event) => setTender(index, { method: event.target.value as Method })}
                            value={tender.method}
                          >
                            {cashMethods.map((value) => (
                              <option key={value} value={value}>{codes("method", value)}</option>
                            ))}
                          </SelectField>
                          {index > 0 ? (
                            <IconButton label={t("removePayment")} onClick={() => setTenders((current) => current.filter((_, rowIndex) => rowIndex !== index))} tone="danger">
                              <TrashIcon />
                            </IconButton>
                          ) : null}
                        </div>
                        <Field inputMode="decimal" label={tender.method === "CASH" ? t("tendered") : t("amount")} onChange={(event) => setTender(index, { amount: event.target.value })} value={tender.amount} />
                        {tender.method !== "CASH" ? (
                          <Field label={t("reference")} maxLength={100} onChange={(event) => setTender(index, { reference: event.target.value })} value={tender.reference} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {paymentPlan === "PAID" ? (
                  <button
                    className={`inline-flex items-center gap-1.5 self-start rounded-sm text-sm font-semibold text-brand-ink hover:underline ${focusRing}`}
                    onClick={() => setTenders((current) => [...current, { method: "CASH", amount: "", reference: "" }])}
                    type="button"
                  >
                    <PlusIcon className="size-4" />
                    {t("addPayment")}
                  </button>
                ) : null}

                {paymentPlan === "DEPOSIT" ? (
                  <div className="flex flex-col gap-3">
                    <Field inputMode="decimal" label={t("depositAmount")} onChange={(event) => setDepositAmount(event.target.value)} value={depositAmount} />
                    <MethodPicker label={t("depositMethod")} onChange={setDepositMethod} value={depositMethod} />
                    {depositMethod !== "CASH" ? (
                      <Field label={t("reference")} maxLength={100} onChange={(event) => setDepositReference(event.target.value)} value={depositReference} />
                    ) : null}
                    {preview && /^\d+(\.\d{0,2})?$/.test(depositAmount) && new Decimal(depositAmount).gt(0) && new Decimal(depositAmount).lt(preview.totals?.total ?? 0) ? (
                      <p className="font-semibold text-ink">{t("depositRemaining", { amount: formatAmount(new Decimal(preview.totals?.total ?? 0).minus(depositAmount).toString()) })}</p>
                    ) : null}
                  </div>
                ) : null}
                {paymentPlan !== "PAID" ? <p className="text-sm text-slate">{t("creditPlanHint")}</p> : null}
              </div>
            ) : null}
          </div>

          {/* the error sits beside the button that failed; on a phone both float over the cart */}
          <div className={`${floating} flex flex-col gap-2 lg:static lg:inset-auto lg:z-auto lg:rounded-none lg:rounded-b-panel lg:border-0 lg:border-t lg:bg-white lg:px-5 lg:py-3 lg:shadow-none lg:backdrop-blur-none`}>
            {error && errorAt === "cart" && triedFor === attempt ? <Alert>{error}</Alert> : null}
            <div className="flex gap-2">
              <Button
                busy={busy === "hold"}
                disabled={!ready || (busy !== undefined && busy !== "hold")}
                onClick={() => void hold()}
                type="button"
                variant="secondary"
              >
                {t("hold")}
              </Button>
              <Button
                busy={busy === "charge"}
                className="flex-1"
                disabled={!ready || (busy !== undefined && busy !== "charge")}
                onClick={() => void checkout()}
                size="lg"
                type="button"
              >
                {t("charge")}
                {total ? <span aria-hidden="true" className="tabular-nums">· {formatAmount(total.toString())}</span> : null}
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* below a laptop the cart is one tap away, with what it holds and what it costs */}
      {lines.length > 0 && view === "items" ? (
        <div className={`${floating} lg:hidden`}>
          <button className={buttonClasses("primary", "w-full justify-between", "lg")} onClick={openCart} type="button">
            <span className="flex items-center gap-2">
              <CartIcon className="size-5" />
              {t("viewCart")}
              <span className="rounded-full bg-navy/10 px-2 text-sm tabular-nums">{lines.length}</span>
            </span>
            <span className="tabular-nums">{total ? formatAmount(total.toString()) : "…"}</span>
          </button>
        </div>
      ) : null}

      <Modal onClose={() => setChoosingCustomer(false)} open={choosingCustomer} title={t("customer")}>
        <div className="flex flex-col gap-4">
          <form className="flex items-end gap-2" onSubmit={(event) => void searchCustomers(event)}>
            <Field className="flex-1" label={t("customerSearch")} onChange={(event) => setCustomerQuery(event.target.value)} value={customerQuery} />
            <Button busy={busy === "search"} type="submit" variant="secondary">{t("searchCustomers")}</Button>
          </form>
          {found.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line">
              {found.map((row) => (
                <li key={row.id}>
                  <button
                    className={`flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-brand-soft/60 motion-reduce:transition-none ${insetFocusRing}`}
                    onClick={() => chooseCustomer(row)}
                    type="button"
                  >
                    <Monogram className="size-9 rounded-full text-xs" name={row.name ?? ""} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{row.name}</span>
                      {row.phone ? <span className="block text-xs text-slate tabular-nums">{row.phone}</span> : null}
                    </span>
                    <span className="font-semibold text-brand-ink">{t("selectCustomer")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : searched ? (
            <p className="text-sm text-slate">{t("noCustomers")}</p>
          ) : null}
          <form className="flex flex-col gap-4 border-t border-line pt-4" onSubmit={(event) => void createCustomer(event)}>
            <p className="text-sm font-semibold text-ink">{t("newCustomer")}</p>
            <Field label={t("newCustomerName")} onChange={(event) => setNewName(event.target.value)} required value={newName} />
            <Field label={t("newCustomerPhone")} onChange={(event) => setNewPhone(event.target.value)} type="tel" value={newPhone} />
            <Button busy={busy === "customer"} disabled={!newName.trim()} type="submit">
              <PlusIcon className="size-4" />
              {t("addCustomer")}
            </Button>
          </form>
          {error && errorAt === "customer" ? <Alert>{error}</Alert> : null}
        </div>
      </Modal>

      <Modal onClose={() => setClosing(false)} open={closing} title={t("closeShift")}>
        <form className="flex flex-col gap-4" onSubmit={(event) => void closeShift(event)}>
          {drawer ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate">{t("openingFloat")}</dt>
              <dd className="text-right tabular-nums">{formatAmount(drawer.openingFloat)}</dd>
              <dt className="text-slate">{t("cashSales")}</dt>
              <dd className="text-right tabular-nums">{formatAmount(drawer.cashSales)}</dd>
              <dt className="text-slate">{t("cashRepayments")}</dt>
              <dd className="text-right tabular-nums">{formatAmount(drawer.cashRepayments)}</dd>
              <dt className="text-slate">{t("cashRefunds")}</dt>
              <dd className="text-right tabular-nums">{formatAmount(drawer.cashRefunds)}</dd>
              <dt className="text-slate">{t("cashExpenses")}</dt>
              <dd className="text-right tabular-nums">{formatAmount(drawer.cashExpenses)}</dd>
              <dt className="text-slate">{t("cashSupplierPayments")}</dt>
              <dd className="text-right tabular-nums">{formatAmount(drawer.cashSupplierPayments)}</dd>
              <dt className="border-t border-line pt-2 font-semibold text-ink">{t("expectedCash")}</dt>
              <dd className="border-t border-line pt-2 text-right font-semibold tabular-nums">{formatAmount(drawer.expectedCash)}</dd>
            </dl>
          ) : (
            <LoadingRows className="h-6" rows={3} />
          )}
          <Field inputMode="decimal" label={t("counted")} onChange={(event) => setCounted(event.target.value)} value={counted} />
          {error && errorAt === "shift" ? <Alert>{error}</Alert> : null}
          <Button busy={busy === "shift"} type="submit" variant="navy">{t("closeShift")}</Button>
        </form>
      </Modal>
    </Page>
  );
}

/** One line of the totals: its label, and the amount set in the receipt's figures. */
function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-slate">{label}</dt>
      <dd className="font-mono text-[0.8125rem] text-ink tabular-nums">{value}</dd>
    </div>
  );
}
