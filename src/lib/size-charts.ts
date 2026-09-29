import type { Schemas } from "@/lib/backend";
import { readJson } from "@/lib/read-json";

export type SizeChart = Schemas["SizeChartView"];
export type SizeChartTemplate = Schemas["SizeChartTemplateView"];
export type SizeChartKind = NonNullable<SizeChart["kind"]>;

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

/** The chart a choice stands for — a library chart before the shop has taken it too. */
export function choiceChart(
  choice: ChartChoice,
  charts: SizeChart[],
  library: SizeChartTemplate[],
): { shortName?: string; labels?: string[] } | undefined {
  if (choice.startsWith("chart:")) {
    return charts.find((chart) => chart.id === choice.slice("chart:".length));
  }
  if (choice.startsWith("library:")) {
    return library.find((template) => template.key === choice.slice("library:".length));
  }
  return undefined;
}

/** "EU 38", or "M" for a chart without a short name — as the backend names the product. */
export function sizeDisplay(chart: { shortName?: string } | undefined, label: string) {
  return chart?.shortName ? `${chart.shortName} ${label}` : label;
}

/** Sizes typed into one box: split on commas and new lines, trimmed, blanks and repeats dropped. */
export function parseLabels(text: string) {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const part of text.split(/[,\n，、]/)) {
    const label = part.trim();
    if (label && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      labels.push(label);
    }
  }
  return labels;
}
