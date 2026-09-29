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
import {
  categorySizing,
  loadCategoryLibrary,
  readyChoice,
  resolveCategory,
  unusedTemplates,
  type Category,
  type CategoryChoice,
  type CategoryTemplate,
  type Sizing,
} from "@/lib/categories";
import { messageFor, readJson } from "@/lib/read-json";
import { chartChoice, loadSizeCharts, resolveChart, type ChartChoice, type SizeChart, type SizeChartTemplate } from "@/lib/size-charts";

type Product = Schemas["ProductView"];

function fetchAll() {
  return Promise.all([
    readJson<Category[]>("/api/catalog/categories"),
    readJson<Product[]>("/api/catalog/products"),
    loadSizeCharts(),
    loadCategoryLibrary(),
  ]);
}

export function CategoryManager() {
  const t = useTranslations("categories");
  const sizes = useTranslations("sizeCharts");
  const names = useTranslations("sizeLibrary");
  const readyNames = useTranslations("categoryLibrary");
  const errors = useTranslations("errors");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [charts, setCharts] = useState<SizeChart[]>([]);
  const [library, setLibrary] = useState<SizeChartTemplate[]>([]);
  const [templates, setTemplates] = useState<CategoryTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [parent, setParent] = useState<CategoryChoice>("");
  const [chart, setChart] = useState<ChartChoice>("");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Category>();
  const [newName, setNewName] = useState("");
  const [managing, setManaging] = useState(false);
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState<"add" | "rename">();

  function show([nextCategories, nextProducts, [nextCharts, nextLibrary], nextTemplates]: Awaited<ReturnType<typeof fetchAll>>) {
    setCategories(nextCategories);
    setProducts(nextProducts);
    setCharts(nextCharts);
    setLibrary(nextLibrary);
    setTemplates(nextTemplates);
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

  const readyName = (template: CategoryTemplate) =>
    template.key && readyNames.has(template.key) ? readyNames(template.key) : (template.name ?? "");
  const ready = unusedTemplates(templates, categories, readyName);
  const sizingOf = (choice: CategoryChoice): Sizing => categorySizing(choice, categories, templates, charts);

  function fail(caught: unknown) {
    setFormError(messageFor(caught, errors, (code) => errors.has(code)));
  }

  /** The chosen chart's id, taking a library chart into the shop first. */
  async function chartId(choice: ChartChoice) {
    return (await resolveChart(choice, charts, (key) => libraryName(names, { key })))?.id;
  }

  /** A new category takes its parent's sizes: Footwear's shoe table, and only footwear tables. */
  function pickParent(choice: CategoryChoice) {
    setParent(choice);
    setChart(choice ? sizingOf(choice).choice : "");
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    setBusy("add");
    try {
      const parentId = await resolveCategory(parent, templates, {
        category: (key) => (readyNames.has(key) ? readyNames(key) : ""),
        sizeChart: (key) => libraryName(names, { key }),
      });
      await readJson("/api/catalog/categories", {
        method: "POST",
        body: JSON.stringify({ name, parentId, sizeChartId: await chartId(chart) }),
      });
      setName("");
      setParent("");
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
        setParent("");
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

  // the sizes that fit: a new category takes its parent's; an existing one its parent's, or its own ready-made kind
  const addSizing: Sizing = parent ? sizingOf(parent) : { choice: "" };
  const editSizing: Sizing = !renaming
    ? { choice: "" }
    : renaming.parentId
      ? sizingOf(renaming.parentId)
      : renaming.templateKey
        ? sizingOf(renaming.id ?? "")
        : { choice: "" };
  const chartSelect = (sizing: Sizing, owner: string) =>
    sizing.none ? (
      <p className="text-sm text-slate">{sizes("noSizesFor", { category: owner })}</p>
    ) : (
      <SizeChartSelect
        charts={charts}
        hint={sizes("categoryHint")}
        allowed={sizing.allowed}
        kind={sizing.kind}
        label={sizes("chart")}
        library={library}
        noneLabel={sizes("noChart")}
        onChange={setChart}
        value={chart}
      />
    );
  const parentLabel = (choice: CategoryChoice) =>
    choice.startsWith("ready:")
      ? readyName(templates.find((template) => readyChoice(template) === choice) ?? {})
      : (categories.find((category) => category.id === choice)?.name ?? "");

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
          <div className="flex flex-col gap-2">
            <SelectField label={t("parent")} onChange={(event) => pickParent(event.target.value)} value={parent}>
              <option value="">{t("noParent")}</option>
              {categories.some((category) => !category.parentId) ? (
                <optgroup label={t("yours")}>
                  {categories
                    .filter((category) => !category.parentId)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </optgroup>
              ) : null}
              {ready.length > 0 ? (
                <optgroup label={t("readyMade")}>
                  {ready.map((template) => (
                    <option key={template.key} value={readyChoice(template)}>
                      {readyName(template)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </SelectField>
            <p className="text-xs text-slate">{t("parentHint")}</p>
          </div>
          {chartSelect(addSizing, parentLabel(parent))}
          {formError ? <Alert>{formError}</Alert> : null}
          <Button busy={busy === "add"} className="self-start" disabled={!name} type="submit">
            {t("add")}
          </Button>
        </form>
      </Modal>

      <Modal onClose={() => setRenaming(undefined)} open={renaming !== undefined} title={t("renameTitle")}>
        <form className="flex flex-col gap-4" onSubmit={(event) => void rename(event)}>
          <Field label={t("rename")} onChange={(event) => setNewName(event.target.value)} required value={newName} />
          {chartSelect(editSizing, renaming?.parentId ? parentLabel(renaming.parentId) : (renaming?.name ?? ""))}
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
