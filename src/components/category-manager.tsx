"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { BoxIcon, PlusIcon } from "@/components/icons";
import { SizeChartManager } from "@/components/size-chart-manager";
import { libraryName, SizeChartSelect } from "@/components/size-chart-select";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  insetFocusRing,
  LoadingRows,
  Modal,
  Page,
  PageHeader,
  SearchField,
  SelectField,
} from "@/components/ui";
import type { Schemas } from "@/lib/backend";
import { messageFor, readJson } from "@/lib/read-json";
import { chartChoice, loadSizeCharts, resolveChart, type ChartChoice, type SizeChart, type SizeChartTemplate } from "@/lib/size-charts";

type Category = Schemas["CategoryView"];
type Product = Schemas["ProductView"];

function fetchAll() {
  return Promise.all([
    readJson<Category[]>("/api/catalog/categories"),
    readJson<Product[]>("/api/catalog/products"),
    loadSizeCharts(),
  ]);
}

export function CategoryManager() {
  const t = useTranslations("categories");
  const sizes = useTranslations("sizeCharts");
  const names = useTranslations("sizeLibrary");
  const errors = useTranslations("errors");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [charts, setCharts] = useState<SizeChart[]>([]);
  const [library, setLibrary] = useState<SizeChartTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [chart, setChart] = useState<ChartChoice>("");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Category>();
  const [newName, setNewName] = useState("");
  const [managing, setManaging] = useState(false);
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState<"add" | "rename">();

  function show([nextCategories, nextProducts, [nextCharts, nextLibrary]]: Awaited<ReturnType<typeof fetchAll>>) {
    setCategories(nextCategories);
    setProducts(nextProducts);
    setCharts(nextCharts);
    setLibrary(nextLibrary);
  }

  async function load() {
    show(await fetchAll());
  }

  useEffect(() => {
    void fetchAll()
      .then(show)
      .catch((caught) => setError(messageFor(caught, errors, (code) => errors.has(code))))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- translator identity is not a reload
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return categories.filter((category) => !needle || (category.name ?? "").toLowerCase().includes(needle));
  }, [categories, query]);

  function fail(caught: unknown) {
    setFormError(messageFor(caught, errors, (code) => errors.has(code)));
  }

  /** The chosen chart's id, taking a library chart into the shop first. */
  async function chartId(choice: ChartChoice) {
    return (await resolveChart(choice, charts, (key) => libraryName(names, { key })))?.id;
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    setBusy("add");
    try {
      await readJson("/api/catalog/categories", {
        method: "POST",
        body: JSON.stringify({ name, parentId: parentId || undefined, sizeChartId: await chartId(chart) }),
      });
      setName("");
      setParentId("");
      setChart("");
      setAdding(false);
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    if (!renaming?.id || !newName.trim()) {
      return;
    }
    setFormError(undefined);
    setBusy("rename");
    try {
      const sizeChartId = await chartId(chart);
      await readJson(`/api/catalog/categories/${renaming.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: newName, sizeChartId, clearSizeChart: !sizeChartId && Boolean(renaming.sizeChartId) }),
      });
      setRenaming(undefined);
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(undefined);
    }
  }

  const parentName = (category: Category) => categories.find((row) => row.id === category.parentId)?.name;
  const chartName = (category: Category) => charts.find((row) => row.id === category.sizeChartId)?.name;
  const count = (category: Category) => products.filter((product) => product.categoryId === category.id).length;
  const openRename = (category: Category) => {
    setFormError(undefined);
    setNewName(category.name ?? "");
    setChart(category.sizeChartId ? chartChoice({ id: category.sizeChartId }) : "");
    setRenaming(category);
  };
  const addButton = (variant: "primary" | "secondary") => (
    <Button
      onClick={() => {
        setFormError(undefined);
        setChart("");
        setAdding(true);
      }}
      type="button"
      variant={variant}
    >
      <PlusIcon className="size-5" />
      {t("add")}
    </Button>
  );
  const chartSelect = (
    <SizeChartSelect
      charts={charts}
      hint={sizes("categoryHint")}
      label={sizes("chart")}
      library={library}
      noneLabel={sizes("noChart")}
      onChange={setChart}
      value={chart}
    />
  );

  return (
    <Page>
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setManaging(true)} type="button" variant="secondary">
              {sizes("manage")}
            </Button>
            {addButton("primary")}
          </div>
        }
        subtitle={t("subtitle")}
        title={t("title")}
      />
      {categories.length > 0 ? <SearchField label={t("search")} onChange={(event) => setQuery(event.target.value)} value={query} /> : null}
      {error ? <Alert>{error}</Alert> : null}

      {!loaded ? (
        <LoadingRows rows={4} />
      ) : categories.length === 0 ? (
        error ? null : <EmptyState action={addButton("secondary")} hint={t("emptyHint")} icon={<BoxIcon className="size-6" />} title={t("empty")} />
      ) : rows.length === 0 ? (
        <EmptyState hint={t("noMatchHint")} title={t("noMatch")} />
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-panel border border-line bg-white shadow-xs">
          {rows.map((category) => (
            <li key={category.id}>
              <button
                className={`flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-slate-50 motion-reduce:transition-none ${insetFocusRing}`}
                onClick={() => openRename(category)}
                type="button"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{category.name}</span>
                  {parentName(category) ? <span className="block truncate text-xs text-slate">{t("inParent", { parent: parentName(category) ?? "" })}</span> : null}
                  {chartName(category) ? <span className="block truncate text-xs text-slate">{sizes("sizesOf", { chart: chartName(category) ?? "" })}</span> : null}
                </span>
                <span className="shrink-0 text-sm text-slate tabular-nums">{t("productCount", { count: count(category) })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal onClose={() => setAdding(false)} open={adding} title={t("create")}>
        <form className="flex flex-col gap-4" onSubmit={(event) => void add(event)}>
          <Field label={t("name")} onChange={(event) => setName(event.target.value)} required value={name} />
          <SelectField label={t("parent")} onChange={(event) => setParentId(event.target.value)} value={parentId}>
            <option value="">{t("noParent")}</option>
            {categories
              .filter((category) => !category.parentId)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </SelectField>
          <p className="text-xs text-slate">{t("parentHint")}</p>
          {chartSelect}
          {formError ? <Alert>{formError}</Alert> : null}
          <Button busy={busy === "add"} className="self-start" disabled={!name} type="submit">
            {t("add")}
          </Button>
        </form>
      </Modal>

      <Modal onClose={() => setRenaming(undefined)} open={renaming !== undefined} title={t("renameTitle")}>
        <form className="flex flex-col gap-4" onSubmit={(event) => void rename(event)}>
          <Field label={t("rename")} onChange={(event) => setNewName(event.target.value)} required value={newName} />
          {chartSelect}
          {renaming ? <p className="text-sm text-slate">{t("productCount", { count: count(renaming) })}</p> : null}
          {formError ? <Alert>{formError}</Alert> : null}
          <Button busy={busy === "rename"} className="self-start" disabled={!newName.trim()} type="submit">
            {t("save")}
          </Button>
        </form>
      </Modal>

      <SizeChartManager charts={charts} library={library} onChanged={load} onClose={() => setManaging(false)} open={managing} />
    </Page>
  );
}
