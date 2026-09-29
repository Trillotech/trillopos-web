"use client";

import { useTranslations } from "next-intl";

import { SelectField } from "@/components/ui";
import { chartChoice, sizeChartKinds, type ChartChoice, type SizeChart, type SizeChartTemplate } from "@/lib/size-charts";

/**
 * Choose a size chart: the shop's own first, then the library charts it has not taken yet, grouped
 * into shoes, clothes and other. A library chart becomes the shop's own when the form is saved.
 */
export function SizeChartSelect({
  label,
  noneLabel,
  charts,
  library,
  value,
  onChange,
  hint,
}: {
  label: string;
  noneLabel: string;
  charts: SizeChart[];
  library: SizeChartTemplate[];
  value: ChartChoice;
  onChange: (choice: ChartChoice) => void;
  hint?: string;
}) {
  const t = useTranslations("sizeCharts");
  const names = useTranslations("sizeLibrary");
  const taken = new Set(charts.map((chart) => chart.templateKey).filter(Boolean));
  return (
    <div className="flex flex-col gap-2">
      <SelectField label={label} onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">{noneLabel}</option>
        {charts.length > 0 ? (
          <optgroup label={t("yours")}>
            {charts.map((chart) => (
              <option key={chart.id} value={chartChoice(chart)}>
                {chart.name}
              </option>
            ))}
          </optgroup>
        ) : null}
        {sizeChartKinds.map((kind) => {
          const templates = library.filter((template) => template.kind === kind && !taken.has(template.key));
          return templates.length > 0 ? (
            <optgroup key={kind} label={t("libraryGroup", { kind: t(`kinds.${kind}`) })}>
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
