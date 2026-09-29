import type { Schemas } from "@/lib/backend";
import { readJson } from "@/lib/read-json";
import { chartChoice, type ChartChoice, type SizeChart, type SizeChartKind } from "@/lib/size-charts";

export type Category = Schemas["CategoryView"];
export type CategoryTemplate = Schemas["CategoryTemplateView"];

/**
 * A category picker's value: a category's id, "ready:<key>" for a ready-made category the shop
 * has not used yet, "" for none.
 */
export type CategoryChoice = string;

export const readyChoice = (template: { key?: string }) => `ready:${template.key ?? ""}`;

/** The sizes a category comes with: the size tables that fit, and the one it opens with. */
export type Sizing = {
  /** Only tables of this kind fit; undefined when any may. */
  kind?: SizeChartKind;
  /** Only these library tables fit (Footwear: shoes, sneakers, kids’ shoes), and tables of `kind` the shop made itself. */
  allowed?: string[];
  /** Goods without sizes (Drinks): no size table is offered. */
  none?: boolean;
  /** The table it opens with; "" for none. */
  choice: ChartChoice;
};

export function loadCategoryLibrary() {
  return readJson<CategoryTemplate[]>("/api/catalog/categories/library");
}

/**
 * The ready-made categories the shop has not used yet. One of its own with the same name (it typed
 * "Footwear" itself) counts as used.
 */
export function unusedTemplates(templates: CategoryTemplate[], categories: Category[], name: (template: CategoryTemplate) => string) {
  const keys = new Set(categories.map((category) => category.templateKey).filter(Boolean));
  const names = new Set(categories.filter((category) => !category.parentId).map((category) => (category.name ?? "").trim().toLowerCase()));
  return templates.filter((template) => !keys.has(template.key) && !names.has(name(template).trim().toLowerCase()));
}

function templateSizing(template: CategoryTemplate | undefined, charts: SizeChart[]): Sizing {
  if (!template) {
    return { choice: "" };
  }
  if (!template.sizeTemplateKey) {
    return { none: true, choice: "" };
  }
  const copy = charts.find((chart) => chart.templateKey === template.sizeTemplateKey);
  return {
    kind: template.sizeKind,
    allowed: template.sizeTemplateKeys,
    choice: copy ? chartChoice(copy) : `library:${template.sizeTemplateKey}`,
  };
}

/**
 * The sizes a category choice comes with. A ready-made category brings its own; a sub-category
 * takes its parent's kind, and its parent's table unless it has one; a category of the shop's own
 * is known by the table it has.
 */
export function categorySizing(choice: CategoryChoice, categories: Category[], templates: CategoryTemplate[], charts: SizeChart[]): Sizing {
  if (choice.startsWith("ready:")) {
    return templateSizing(templates.find((template) => template.key === choice.slice("ready:".length)), charts);
  }
  const category = categories.find((row) => row.id === choice);
  if (!category) {
    return { choice: "" };
  }
  const own = charts.find((chart) => chart.id === category.sizeChartId);
  const template = templates.find((row) => row.key === category.templateKey);
  const parent = category.parentId ? categorySizing(category.parentId, categories, templates, charts) : undefined;
  const fromTemplate = template ? templateSizing(template, charts) : undefined;
  const kind = fromTemplate ? fromTemplate.kind : (parent?.kind ?? own?.kind);
  const allowed = fromTemplate ? fromTemplate.allowed : parent?.allowed;
  const none = !own && (fromTemplate?.none ?? parent?.none ?? false);
  const opening = own ? chartChoice(own) : (parent?.choice || fromTemplate?.choice || "");
  return { kind, allowed, none, choice: none ? "" : opening };
}

/**
 * The shop's category for a choice. A ready-made one is made the shop's own first, under its name
 * and its size table's name in the owner's language (the backend hands back the one it has, if any).
 */
export async function resolveCategory(
  choice: CategoryChoice,
  templates: CategoryTemplate[],
  names: { category: (key: string) => string; sizeChart: (key: string) => string },
): Promise<string | undefined> {
  if (!choice) {
    return undefined;
  }
  if (!choice.startsWith("ready:")) {
    return choice;
  }
  const template = templates.find((row) => row.key === choice.slice("ready:".length));
  const created = await readJson<Category>("/api/catalog/categories", {
    method: "POST",
    body: JSON.stringify({
      templateKey: template?.key,
      name: template?.key ? names.category(template.key) : undefined,
      sizeChartName: template?.sizeTemplateKey ? names.sizeChart(template.sizeTemplateKey) : undefined,
    }),
  });
  return created.id;
}
