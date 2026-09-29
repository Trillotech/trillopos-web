import type { Schemas } from "@/lib/backend";
import { readJson } from "@/lib/read-json";

export type SizeChart = Schemas["SizeChartView"];
export type SizeChartTemplate = Schemas["SizeChartTemplateView"];
export type SizeChartKind = NonNullable<SizeChart["kind"]>;

/** What a size table is made of: the systems (the labelling one first) and a row per size. */
export type SizeTable = { systems?: string[]; rows?: string[][] };

export const sizeChartKinds: SizeChartKind[] = ["FOOTWEAR", "CLOTHING", "OTHER"];

/**
 * A size chart picker's value: "chart:<id>" for one of the shop's charts, "library:<key>" for a
 * library chart the shop has not taken yet, "" for none.
 */
export type ChartChoice = string;

export const chartChoice = (chart: { id?: string }) => (chart.id ? `chart:${chart.id}` : "");

export async function loadSizeCharts() {
  return Promise.all([
    readJson<SizeChart[]>("/api/catalog/size-charts"),
    readJson<SizeChartTemplate[]>("/api/catalog/size-charts/library"),
  ]);
}

/**
 * The shop's chart for a choice. A library choice is copied into the shop first (the backend hands
 * back the copy it already has, if any), under `name` — the library name in the owner's language.
 */
export async function resolveChart(
  choice: ChartChoice,
  charts: SizeChart[],
  name: (key: string) => string,
): Promise<SizeChart | undefined> {
  if (choice.startsWith("chart:")) {
    return charts.find((chart) => chart.id === choice.slice("chart:".length));
  }
  if (choice.startsWith("library:")) {
    const templateKey = choice.slice("library:".length);
    return readJson<SizeChart>("/api/catalog/size-charts", {
      method: "POST",
      body: JSON.stringify({ templateKey, name: name(templateKey) }),
    });
  }
  return undefined;
}

/** The table a choice stands for — a library table before the shop has taken it too. */
export function choiceChart(choice: ChartChoice, charts: SizeChart[], library: SizeChartTemplate[]): SizeTable | undefined {
  if (choice.startsWith("chart:")) {
    return charts.find((chart) => chart.id === choice.slice("chart:".length));
  }
  if (choice.startsWith("library:")) {
    return library.find((template) => template.key === choice.slice("library:".length));
  }
  return undefined;
}

/** Each size's label: the labelling system's column. */
export const sizeLabels = (table: SizeTable | undefined) => (table?.rows ?? []).map((row) => row[0]);

const named = (system: string | undefined, label: string) => (system ? `${system} ${label}` : label);

/** "EU 42", or "M" when the labelling system has no name — as the backend names the product. */
export function sizeDisplay(table: SizeTable | undefined, label: string) {
  return named(table?.systems?.[0], label);
}

/** The same size in the other systems, "UK 8 · US M 9 · CM 26.5", as the backend stores it. */
export function sizeEquivalents(table: SizeTable | undefined, label: string) {
  const row = table?.rows?.find((cells) => cells[0] === label);
  const systems = table?.systems ?? [];
  return (row ?? [])
    .map((cell, index) => (index > 0 && cell ? named(systems[index], cell) : ""))
    .filter(Boolean)
    .join(" · ");
}

/** "EU · UK · US M · US W · CM", a column without a name read as `unnamed`. */
export function systemsLine(table: SizeTable | undefined, unnamed: string) {
  return (table?.systems ?? []).map((system) => system || unnamed).join(" · ");
}

/** "35 – 48": the first and the last size. */
export function sizeRange(table: SizeTable | undefined) {
  const labels = sizeLabels(table);
  return labels.length > 1 ? `${labels[0]} – ${labels[labels.length - 1]}` : (labels[0] ?? "");
}
