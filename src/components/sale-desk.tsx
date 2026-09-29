"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowDownIcon, CartIcon, ChevronDownIcon, PlusIcon, TrashIcon } from "@/components/icons";
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
  Page,
  PageHeader,
  Panel,
  SearchField,
  SelectField,
} from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import type { Schemas } from "@/lib/backend";
import { useCodes } from "@/lib/codes";
import { formatAmount, addQuantities } from "@/lib/money";
import { messageFor, readJson } from "@/lib/read-json";
import { useMembershipRole } from "@/lib/role";
import { matchesWords } from "@/lib/search";

type Product = Schemas["ProductView"];
type Location = Schemas["LocationView"];
type Shift = Schemas["ShiftView"];
type Customer = Schemas["CustomerView"];
type Method = Schemas["PaymentRequest"]["method"];

type Line = { productId: string; name: string; quantity: string; discount: string };
/** In the shop: a register shift and its drawer. Online: an order from Facebook, Viber or the phone — no shift. */
type Mode = "STORE" | "ONLINE";
type Tender = { method: Method; amount: string; reference: string };
/** Which request is in flight, so its button spins and the others wait. */
type Busy = "charge" | "hold" | "shift" | "customer" | "search";
/** Where an error is shown: next to the thing that failed. */
type ErrorAt = "shift" | "customer" | "cart";

const cashMethods = ["CASH", "KBZ_PAY", "WAVE_PAY", "AYA_PAY", "CB_PAY", "BANK_TRANSFER", "OTHER"] as const;

export function SaleDesk() {
  const { locationId: scope, register } = useMembershipRole();
  const t = useTranslations("sale");
  const errors = useTranslations("errors");
  const codes = useCodes();
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [shift, setShift] = useState<Shift>();
  const [shiftFor, setShiftFor] = useState<string>();
  const [drawer, setDrawer] = useState<Schemas["Drawer"]>();
  const [floatAmount, setFloatAmount] = useState("0");
  const [counted, setCounted] = useState("");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [cartDiscount, setCartDiscount] = useState("");
  const [tenders, setTenders] = useState<Tender[]>([{ method: "CASH", amount: "", reference: "" }]);
  const [priceChoice, setPriceChoice] = useState<"" | "RETAIL" | "WHOLESALE">("RETAIL");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searched, setSearched] = useState(false);
  const [customer, setCustomer] = useState<Customer>();
  const [error, setError] = useState<string>();
  const [errorAt, setErrorAt] = useState<ErrorAt>("cart");
  const [busy, setBusy] = useState<Busy>();
  const [key] = useState(() => crypto.randomUUID());
  const [mode, setMode] = useState<Mode>("STORE");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const stores = locations.filter((row) => row.type === "STORE" && row.active !== false);
  const methods: Method[] = customer ? [...cashMethods, "CREDIT"] : [...cashMethods];
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
    void readJson<Schemas["OrganizationView"]>("/api/catalog/organization").then((org) => {
      if (org.businessType === "ONLINE" && !register) {
        chooseMode("ONLINE");
      }
    });
  }, [scope, register]);

  useEffect(() => {
    if (!locationId) {
      return;
    }
    void readJson<Shift>(`/api/sales/shifts?locationId=${locationId}`)
      .then(setShift)
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

  const visible = products.filter((product) => {
    const needle = query.trim().toLowerCase();
    const listed = mode === "ONLINE" ? product.sellOnline === true : product.sellInPos !== false;
    return product.active !== false && listed && (!needle || matchesWords(needle, product.name, product.sku, product.sizeEquivalents));
  });

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
        return current.map((line) => line.productId === product.id ? { ...line, quantity: addQuantities([line.quantity, "1"]) } : line);
      }
      return [...current, { productId: product.id!, name: product.name ?? "", quantity: "1", discount: "" }];
    });
  }

  function cartBody() {
    return {
      locationId,
      channel: mode === "ONLINE" ? "ONLINE" : "POS",
      cashierShiftId: mode === "STORE" ? shift?.id : undefined,
      customerId: customer?.id,
      priceType: priceChoice || undefined,
      cartDiscountAmount: cartDiscount || undefined,
      lines: lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        discountAmount: line.discount || undefined,
      })),
    };
  }

  function payments() {
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
    setError(undefined);
    setErrorAt("cart");
    if (mode === "STORE" && !shift?.id) {
      setError(t("needShift"));
      return;
    }
    if (tenders.some((tender) => tender.method === "CREDIT") && !customer) {
      setError(errors("customer_required"));
      return;
    }
    setBusy("charge");
    try {
      const sale = await readJson<Schemas["SaleView"]>("/api/sales/checkout", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: key, ...cartBody(), payments: payments() }),
      });
      router.push(`/sales/${sale.id}`);
    } catch (caught) {
      fail("cart", caught);
      setBusy(undefined);
    }
  }

  async function hold() {
    setError(undefined);
    setBusy("hold");
    try {
      const parked = await readJson<Schemas["SaleView"]>("/api/sales", {
        method: "POST",
        body: JSON.stringify({ ...cartBody(), hold: true }),
      });
      router.push(`/sales/${parked.id}`);
    } catch (caught) {
      fail("cart", caught);
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
  }

  function showCart() {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("cart")?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  }

  const found = customers.filter((row) => !row.archived);
  const storeSelect = (
    <SelectField label={mode === "ONLINE" ? t("shipFrom") : t("store")} onChange={(event) => setLocationId(event.target.value)} value={locationId}>
      {stores.map((row) => (
        <option key={row.id} value={row.id}>{row.name}</option>
      ))}
    </SelectField>
  );

  return (
    <Page className="pb-32 sm:pb-32 lg:pb-8">
      <PageHeader
        actions={
          <div
            aria-label={t("modeLabel")}
            className="grid w-full grid-cols-2 gap-1 rounded-button border border-line bg-white p-1 shadow-xs sm:w-auto"
            role="radiogroup"
          >
            {(["STORE", "ONLINE"] as const).map((value) => (
              <button
                aria-checked={mode === value}
                className={`min-h-10 rounded-md px-4 text-sm font-semibold transition motion-reduce:transition-none ${focusRing} ${
                  mode === value ? "bg-indigo text-white shadow-xs" : "text-slate hover:bg-slate-100 hover:text-ink"
                }`}
                key={value}
                onClick={() => chooseMode(value)}
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
      {mode === "ONLINE" ? <Alert tone="info">{t("onlineHint")}</Alert> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {mode === "STORE" ? (
            <Panel
              actions={
                shiftKnown ? (
                  <Badge tone={shift?.status === "OPEN" ? "ok" : "muted"}>
                    {shift?.status === "OPEN" ? t("shiftOpen") : t("shiftClosed")}
                  </Badge>
                ) : null
              }
              title={t("shift")}
            >
              <div className="flex flex-col gap-4">
                {storeSelect}
                {!shiftKnown ? (
                  <LoadingRows className="h-10" rows={1} />
                ) : shift?.status === "OPEN" ? (
                  <details className="group">
                    <summary
                      className={`-mx-2 flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-button px-2 text-sm font-semibold text-ink hover:bg-slate-50 sm:min-h-10 [&::-webkit-details-marker]:hidden ${focusRing}`}
                    >
                      {t("closeShift")}
                      <ChevronDownIcon className="size-4 text-slate transition group-open:rotate-180 motion-reduce:transition-none" />
                    </summary>
                    <form className="mt-4 flex flex-col gap-4" onSubmit={(event) => void closeShift(event)}>
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
                      ) : null}
                      <div className="flex flex-wrap items-end gap-2">
                        <Field className="flex-1" inputMode="decimal" label={t("counted")} onChange={(event) => setCounted(event.target.value)} value={counted} />
                        <Button busy={busy === "shift"} type="submit" variant="secondary">{t("closeShift")}</Button>
                      </div>
                    </form>
                  </details>
                ) : (
                  <form className="flex flex-col gap-4" onSubmit={(event) => void openShift(event)}>
                    <p className="text-sm text-slate">{t("needShift")}</p>
                    <div className="flex flex-wrap items-end gap-2">
                      <Field className="flex-1" inputMode="decimal" label={t("float")} onChange={(event) => setFloatAmount(event.target.value)} value={floatAmount} />
                      <Button busy={busy === "shift"} disabled={!locationId} type="submit">{t("openShift")}</Button>
                    </div>
                  </form>
                )}
                {error && errorAt === "shift" ? <Alert>{error}</Alert> : null}
              </div>
            </Panel>
          ) : null}

          <Panel title={t("items")}>
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {mode === "ONLINE" ? storeSelect : null}
                <SelectField
                  label={t("priceType")}
                  onChange={(event) => setPriceChoice(event.target.value as typeof priceChoice)}
                  value={priceChoice}
                >
                  {customer ? (
                    <option value="">{t("customerPrice", { price: codes("priceType", customer.defaultPriceType ?? "RETAIL") })}</option>
                  ) : null}
                  <option value="RETAIL">{codes("priceType", "RETAIL")}</option>
                  <option value="WHOLESALE">{codes("priceType", "WHOLESALE")}</option>
                </SelectField>
              </div>
              {customer && priceChoice === "" ? <p className="text-sm text-slate">{t("priceFromCustomer")}</p> : null}
              <SearchField label={t("search")} onChange={(event) => setQuery(event.target.value)} value={query} />
              {!productsLoaded ? (
                <LoadingRows className="h-12" rows={4} />
              ) : visible.length === 0 ? (
                <p className="rounded-button border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate">
                  {query.trim() ? t("noMatch", { query: query.trim() }) : mode === "ONLINE" ? t("noOnlineProducts") : t("noProducts")}
                </p>
              ) : (
                <>
                  <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-button border border-line lg:max-h-[32rem] lg:overflow-y-auto">
                    {visible.slice(0, 20).map((product) => (
                      <li key={product.id}>
                        <button
                          className={`flex min-h-12 w-full items-center gap-4 px-4 py-2 text-left text-sm transition-colors hover:bg-indigo/5 active:bg-indigo/10 motion-reduce:transition-none ${insetFocusRing}`}
                          onClick={() => add(product)}
                          type="button"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 font-medium break-words text-ink">{product.name}</span>
                            {product.sku || product.sizeEquivalents ? (
                              <span className="block truncate text-xs text-slate">{[product.sizeEquivalents, product.sku].filter(Boolean).join(" · ")}</span>
                            ) : null}
                          </span>
                          <span className="font-semibold text-ink tabular-nums">{formatAmount(product.retailPrice)}</span>
                          <PlusIcon className="size-5 shrink-0 text-indigo" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {visible.length > 20 ? <p className="text-xs text-slate">{t("moreResults")}</p> : null}
                </>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={t("customer")}>
            {customer ? (
              <div className="flex flex-col gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{customer.name}</p>
                  {customer.phone ? <p className="text-sm text-slate tabular-nums">{customer.phone}</p> : null}
                </div>
                <dl className="grid grid-cols-2 gap-4 rounded-button bg-surface p-4 text-sm">
                  <div>
                    <dt className="text-slate">{t("outstanding")}</dt>
                    <dd className="font-semibold tabular-nums">{formatAmount(customer.outstanding)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate">{t("available")}</dt>
                    <dd className="font-semibold tabular-nums">{formatAmount(customer.availableCredit)}</dd>
                  </div>
                </dl>
                <Button
                  onClick={() => {
                    setCustomer(undefined);
                    setPriceChoice("RETAIL");
                    setTenders((current) => current.map((row) => row.method === "CREDIT" ? { ...row, method: "CASH" } : row));
                  }}
                  type="button"
                  variant="secondary"
                >
                  {t("walkIn")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <form className="flex items-end gap-2" onSubmit={(event) => void searchCustomers(event)}>
                  <Field className="flex-1" label={t("customerSearch")} onChange={(event) => setCustomerQuery(event.target.value)} value={customerQuery} />
                  <Button busy={busy === "search"} type="submit" variant="secondary">{t("searchCustomers")}</Button>
                </form>
                {found.length > 0 ? (
                  <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-button border border-line">
                    {found.map((row) => (
                      <li key={row.id}>
                        <button
                          className={`flex min-h-12 w-full items-center gap-4 px-4 py-2 text-left text-sm transition-colors hover:bg-indigo/5 motion-reduce:transition-none ${insetFocusRing}`}
                          onClick={() => chooseCustomer(row)}
                          type="button"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-ink">{row.name}</span>
                            {row.phone ? <span className="block text-xs text-slate tabular-nums">{row.phone}</span> : null}
                          </span>
                          <span className="font-semibold text-indigo">{t("selectCustomer")}</span>
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
                  <Button busy={busy === "customer"} disabled={!newName.trim()} type="submit" variant="secondary">
                    <PlusIcon className="size-4" />
                    {t("addCustomer")}
                  </Button>
                </form>
              </div>
            )}
            {error && errorAt === "customer" ? <div className="mt-4"><Alert>{error}</Alert></div> : null}
          </Panel>

          <Panel
            actions={lines.length > 0 ? <Badge tone="info">{t("cartCount", { count: lines.length })}</Badge> : null}
            className="scroll-mt-24"
            id="cart"
            title={t("cart")}
          >
            <div className="flex flex-col gap-6">
              {lines.length === 0 ? (
                <p className="flex flex-col items-center gap-2 rounded-button border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate">
                  <CartIcon className="size-6" />
                  {t("cartEmpty")}
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {lines.map((line) => (
                    <li className="flex flex-col gap-2 py-4 first:pt-0" key={line.productId}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 pt-2 font-semibold text-ink">{line.name}</p>
                        <IconButton
                          label={t("removeLine", { name: line.name })}
                          onClick={() => setLines((current) => current.filter((row) => row.productId !== line.productId))}
                          tone="danger"
                        >
                          <TrashIcon />
                        </IconButton>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field inputMode="decimal" label={t("qty")} onChange={(event) => setLines((current) => current.map((row) => row.productId === line.productId ? { ...row, quantity: event.target.value } : row))} value={line.quantity} />
                        <Field inputMode="decimal" label={t("lineDiscount")} onChange={(event) => setLines((current) => current.map((row) => row.productId === line.productId ? { ...row, discount: event.target.value } : row))} value={line.discount} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Field inputMode="decimal" label={t("cartDiscount")} onChange={(event) => setCartDiscount(event.target.value)} value={cartDiscount} />

              <div className="flex flex-col gap-4 border-t border-line pt-6" role="group" aria-labelledby="payment-title">
                <h3 className="text-sm font-semibold text-ink" id="payment-title">{t("paymentTitle")}</h3>
                {tenders.map((tender, index) => (
                  <div className={`flex flex-col gap-2 ${tenders.length > 1 ? "rounded-button border border-line p-4" : ""}`} key={index}>
                    <div className="flex items-end gap-2">
                      <SelectField
                        className="flex-1"
                        label={t("method")}
                        onChange={(event) => {
                          const method = event.target.value as Method;
                          setTenders((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, method } : row));
                        }}
                        value={tender.method}
                      >
                        {methods.filter((method) => method !== "CREDIT" || !tenders.some((row, rowIndex) => rowIndex !== index && row.method === "CREDIT")).map((value) => (
                          <option key={value} value={value}>{codes("method", value)}</option>
                        ))}
                      </SelectField>
                      {index > 0 ? (
                        <IconButton
                          label={t("removePayment")}
                          onClick={() => setTenders((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                          tone="danger"
                        >
                          <TrashIcon />
                        </IconButton>
                      ) : null}
                    </div>
                    <Field hint={tenders.length === 1 ? t("amountHint") : undefined} inputMode="decimal" label={tender.method === "CASH" ? t("tendered") : t("amount")} onChange={(event) => setTenders((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, amount: event.target.value } : row))} value={tender.amount} />
                    {tender.method !== "CASH" && tender.method !== "CREDIT" ? (
                      <Field label={t("reference")} onChange={(event) => setTenders((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, reference: event.target.value } : row))} value={tender.reference} />
                    ) : null}
                  </div>
                ))}
                <Button
                  className="-ml-4 self-start"
                  onClick={() => setTenders((current) => [...current, { method: "CASH", amount: "", reference: "" }])}
                  type="button"
                  variant="ghost"
                >
                  <PlusIcon className="size-4" />
                  {t("addPayment")}
                </Button>
                <p className="text-xs text-slate">{t("changeOnReceipt")}</p>
              </div>

              {error && errorAt === "cart" ? <Alert>{error}</Alert> : null}
              <div className="flex flex-col gap-2">
                <Button
                  busy={busy === "charge"}
                  className="w-full"
                  disabled={lines.length === 0 || (busy !== undefined && busy !== "charge")}
                  onClick={() => void checkout()}
                  size="lg"
                  type="button"
                >
                  {t("charge")}
                </Button>
                <Button
                  busy={busy === "hold"}
                  className="w-full"
                  disabled={lines.length === 0 || (busy !== undefined && busy !== "hold")}
                  onClick={() => void hold()}
                  type="button"
                  variant="secondary"
                >
                  {t("hold")}
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* on a phone the cart is far below the products: a bar that is always there takes you to it */}
      {lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-white/95 px-4 pt-2 pb-2 md:bottom-0 md:pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-[0_-4px_16px_rgb(15_23_42/0.08)] backdrop-blur md:left-64 lg:hidden">
          <button className={buttonClasses("primary", "w-full", "lg")} onClick={showCart} type="button">
            <CartIcon className="size-5" />
            {t("cartCount", { count: lines.length })} · {t("goToCart")}
            <ArrowDownIcon className="size-4" />
          </button>
        </div>
      ) : null}
    </Page>
  );
}
