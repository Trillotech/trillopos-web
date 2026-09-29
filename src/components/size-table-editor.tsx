"use client";

import { useTranslations } from "next-intl";

import { CloseIcon, PlusIcon } from "@/components/icons";
import { Button, focusRing, IconButton, SelectField } from "@/components/ui";

const cellInput = `min-h-10 w-14 rounded-control border px-1.5 text-base text-ink tabular-nums shadow-xs transition placeholder:text-slate/60 focus:border-indigo focus:outline-hidden focus:ring-2 focus:ring-indigo/25 motion-reduce:transition-none sm:w-20 sm:px-2 sm:text-sm ${focusRing}`;

/** Headers grey, the labelling column tinted, the rest plain. */
const cellColours = (header: boolean, labelling: boolean) =>
  labelling
    ? `border-indigo/40 font-semibold ${header ? "bg-indigo-100" : "bg-indigo-50"}`
    : header
      ? "border-line bg-surface font-semibold"
      : "border-line bg-white";

/**
 * A size table to edit: a column per sizing system, a row per size. The first column is the one
 * the shop labels its stock with; choosing another moves it to the front.
 */
export function SizeTableEditor({
  systems,
  rows,
  onChange,
}: {
  systems: string[];
  rows: string[][];
  onChange: (systems: string[], rows: string[][]) => void;
}) {
  const t = useTranslations("sizeCharts");
  const name = (index: number) => systems[index] || t("unnamed");

  function labelWith(index: number) {
    const reorder = <T,>(cells: T[]) => [cells[index], ...cells.filter((_, at) => at !== index)];
    onChange(reorder(systems), rows.map(reorder));
  }

  function setSystem(index: number, value: string) {
    onChange(systems.map((system, at) => (at === index ? value : system)), rows);
  }

  function setCell(rowIndex: number, index: number, value: string) {
    onChange(systems, rows.map((row, at) => (at === rowIndex ? row.map((cell, j) => (j === index ? value : cell)) : row)));
  }

  function removeSystem(index: number) {
    onChange(systems.filter((_, at) => at !== index), rows.map((row) => row.filter((_, at) => at !== index)));
  }

  return (
    <div className="flex flex-col gap-4">
      {systems.length > 1 ? (
        <div className="flex flex-col gap-2">
          <SelectField label={t("labelWith")} onChange={(event) => labelWith(Number(event.target.value))} value="0">
            {systems.map((_, index) => (
              <option key={index} value={index}>
                {name(index)}
              </option>
            ))}
          </SelectField>
          <p className="text-xs text-slate">{t("labelWithHint")}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">{t("table")}</p>
        <p className="text-xs text-slate">{t("tableHint")}</p>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                {systems.map((system, index) => (
                  <th className="align-bottom" key={index} scope="col">
                    <input
                      aria-label={t("systemName", { n: index + 1 })}
                      className={`${cellInput} ${cellColours(true, index === 0)}`}
                      maxLength={10}
                      onChange={(event) => setSystem(index, event.target.value)}
                      placeholder={t("unnamed")}
                      value={system}
                    />
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => (
                    <td key={index}>
                      <input
                        aria-label={t("cell", { system: name(index), n: rowIndex + 1 })}
                        className={`${cellInput} ${cellColours(false, index === 0)}`}
                        maxLength={20}
                        onChange={(event) => setCell(rowIndex, index, event.target.value)}
                        value={cell}
                      />
                    </td>
                  ))}
                  <td>
                    <IconButton
                      label={t("removeRow", { size: row[0] || String(rowIndex + 1) })}
                      onClick={() => onChange(systems, rows.filter((_, at) => at !== rowIndex))}
                    >
                      <CloseIcon className="size-4" />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {systems.length > 1 ? (
                <tr>
                  {systems.map((system, index) => (
                    <td className="text-center" key={index}>
                      {index > 0 ? (
                        <IconButton label={t("removeSystem", { system: name(index) })} onClick={() => removeSystem(index)}>
                          <CloseIcon className="size-4" />
                        </IconButton>
                      ) : null}
                    </td>
                  ))}
                  <td />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onChange(systems, [...rows, systems.map(() => "")])} type="button" variant="secondary">
            <PlusIcon className="size-5" />
            {t("addRow")}
          </Button>
          {systems.length < 8 ? (
            <Button onClick={() => onChange([...systems, ""], rows.map((row) => [...row, ""]))} type="button" variant="secondary">
              <PlusIcon className="size-5" />
              {t("addSystem")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
