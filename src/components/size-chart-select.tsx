"use client";

import { useTranslations } from "next-intl";

import { SelectField } from "@/components/ui";
import { chartChoice, sizeChartKinds, type ChartChoice, type SizeChart, type SizeChartKind, type SizeChartTemplate } from "@/lib/size-charts";

/**
 * Choose a size chart: the shop's own first, then the library charts it has not taken yet, grouped
 * into shoes, clothes and other. A library chart becomes the shop's own when the form is saved.
 * `kind` and `allowed` keep to the tables that fit the category: under Footwear, only footwear tables.
 */
export function SizeChartSelect({
  label,
  noneLabel,
  charts,
  library,
  value,
  onChange,
  hint,
  kind,
  allowed,
}: {
  label: string;
  noneLabel: string;
  charts: SizeChart[];
  library: SizeChartTemplate[];
  value: ChartChoice;
  onChange: (choice: ChartChoice) => void;
  hint?: string;
  kind?: SizeChartKind;
  /** Library tables that fit (a ready-made category's own); the shop's own tables must be of `kind`. */
  allowed?: string[];
}) {
  const t = useTranslations("sizeCharts");
  const names = useTranslations("sizeLibrary");
  const taken = new Set(charts.map((chart) => chart.templateKey).filter(Boolean));
  // a table fits when it came from the category's list, or the shop made it and it is of the kind
  const fits = (templateKey: string | undefined, tableKind: SizeChartKind | undefined) =>
    allowed ? (templateKey ? allowed.includes(templateKey) : tableKind === kind) : !kind || tableKind === kind;
  const own = charts.filter((chart) => fits(chart.templateKey, chart.kind));
  return (
    <div className="flex flex-col gap-2">
      <SelectField label={label} onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">{noneLabel}</option>
        {own.length > 0 ? (
          <optgroup label={t("yours")}>
            {own.map((chart) => (
              <option key={chart.id} value={chartChoice(chart)}>
                {chart.name}
              </option>
            ))}
          </optgroup>
        ) : null}
        {sizeChartKinds.filter((group) => !kind || group === kind).map((group) => {
          const templates = library.filter(
            (template) => template.kind === group && !taken.has(template.key) && fits(template.key, template.kind),
          );
          return templates.length > 0 ? (
            <optgroup key={group} label={t("libraryGroup", { kind: t(`kinds.${group}`) })}>
              {templates.map((template) => (
                <option key={template.key} value={`library:${template.key}`}>
                  {libraryName(names, template)}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </SelectField>
      {hint ? <p className="text-xs text-slate">{hint}</p> : null}
    </div>
  );
}

/** A library chart's name in the owner's language; the backend's English one if it is new. */
export function libraryName(
  names: { has: (key: string) => boolean; (key: string): string },
  template: { key?: string; name?: string },
) {
  return template.key && names.has(template.key) ? names(template.key) : (template.name ?? "");
}
