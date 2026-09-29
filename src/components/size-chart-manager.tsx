"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { PlusIcon } from "@/components/icons";
import { libraryName } from "@/components/size-chart-select";
import { SizeTableEditor } from "@/components/size-table-editor";
import { Alert, Badge, Button, ConfirmButton, Field, Modal, SelectField } from "@/components/ui";
import { messageFor, readJson } from "@/lib/read-json";
import {
  sizeChartKinds,
  sizeRange,
  systemsLine,
  type SizeChart,
  type SizeChartKind,
  type SizeChartTemplate,
} from "@/lib/size-charts";

/**
 * The shop's size tables: take one from the library, change it (which system labels the stock,
 * which sizes, the conversions), make one, delete one. Products already made keep the names and
 * sizes they were made with.
 */
export function SizeChartManager({
  open,
  onClose,
  charts,
  library,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  charts: SizeChart[];
  library: SizeChartTemplate[];
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations("sizeCharts");
  const names = useTranslations("sizeLibrary");
  const errors = useTranslations("errors");
  const [editing, setEditing] = useState<SizeChart | "new">();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SizeChartKind>("OTHER");
  const [systems, setSystems] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const taken = new Set(charts.map((chart) => chart.templateKey).filter(Boolean));

  function edit(chart: SizeChart | "new") {
    setError(undefined);
    setName(chart === "new" ? "" : (chart.name ?? ""));
    setKind(chart === "new" ? "OTHER" : (chart.kind ?? "OTHER"));
    // a new table starts with one unnamed column and room for three sizes
    setSystems(chart === "new" ? [""] : [...(chart.systems ?? [""])]);
    setRows(chart === "new" ? [[""], [""], [""]] : (chart.rows ?? []).map((row) => [...row]));
    setEditing(chart);
  }

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(undefined);
    try {
      await action();
      await onChanged();
      return true;
    } catch (caught) {
      setError(messageFor(caught, errors, (code) => errors.has(code)));
      return false;
    } finally {
      setBusy(undefined);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const filled = rows.filter((row) => row.some((cell) => cell.trim()));
    if (!name.trim() || filled.length === 0) {
      setError(t(name.trim() ? "labelsRequired" : "nameRequired"));
      return;
    }
    const body = JSON.stringify({ name, kind, systems, rows: filled });
    const saved = await run("save", () =>
      editing === "new" || !editing?.id
        ? readJson("/api/catalog/size-charts", { method: "POST", body })
        : readJson(`/api/catalog/size-charts/${editing.id}`, { method: "PATCH", body }),
    );
    if (saved) {
      setEditing(undefined);
    }
  }

  async function remove() {
    if (editing && editing !== "new" && (await run("delete", () => readJson(`/api/catalog/size-charts/${editing.id}`, { method: "DELETE" })))) {
      setEditing(undefined);
    }
  }

  function close() {
    setEditing(undefined);
    setError(undefined);
    onClose();
  }

  return (
    <Modal onClose={close} open={open} title={editing ? t(editing === "new" ? "newTitle" : "editTitle") : t("title")} wide>
      {editing ? (
        <form className="flex flex-col gap-4 text-left" onSubmit={(event) => void save(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("name")} maxLength={80} onChange={(event) => setName(event.target.value)} required value={name} />
            <SelectField label={t("kind")} onChange={(event) => setKind(event.target.value as SizeChartKind)} value={kind}>
              {sizeChartKinds.map((value) => (
                <option key={value} value={value}>
                  {t(`kinds.${value}`)}
                </option>
              ))}
            </SelectField>
          </div>
          <SizeTableEditor
            onChange={(nextSystems, nextRows) => {
              setSystems(nextSystems);
              setRows(nextRows);
            }}
            rows={rows}
            systems={systems}
          />
          <p className="text-xs text-slate">{t("brandHint")}</p>
          {error ? <Alert>{error}</Alert> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setEditing(undefined)} type="button" variant="secondary">
              {t("back")}
            </Button>
            <Button busy={busy === "save"} type="submit">
              {t("save")}
            </Button>
          </div>
          {editing !== "new" ? (
            <div className="border-t border-line pt-4">
              <ConfirmButton busy={busy === "delete"} confirmLabel={t("deleteConfirm")} label={t("delete")} onConfirm={() => void remove()} question={t("deleteQuestion")} />
            </div>
          ) : null}
        </form>
      ) : (
        <div className="flex flex-col gap-6 text-left">
          <p className="text-sm text-slate">{t("subtitle")}</p>
          {error ? <Alert>{error}</Alert> : null}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">{t("yours")}</h3>
            {charts.length === 0 ? (
              <p className="text-sm text-slate">{t("none")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line rounded-button border border-line">
                {charts.map((chart) => (
                  <li className="flex items-center gap-4 px-4 py-2" key={chart.id}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{chart.name}</span>
                      <span className="block truncate text-xs text-slate">
                        {t("count", { count: chart.rows?.length ?? 0 })} · {systemsLine(chart, t("unnamed"))}
                      </span>
                    </span>
                    <Button aria-label={t("editFor", { name: chart.name ?? "" })} onClick={() => edit(chart)} type="button" variant="secondary">
                      {t("edit")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button className="self-start" onClick={() => edit("new")} type="button" variant="secondary">
              <PlusIcon className="size-5" />
              {t("own")}
            </Button>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">{t("library")}</h3>
            <p className="text-xs text-slate">{t("libraryHint")}</p>
            {sizeChartKinds.map((group) => {
              const templates = library.filter((template) => template.kind === group);
              return templates.length > 0 ? (
                <div className="flex flex-col gap-1" key={group}>
                  <h4 className="pt-2 text-xs font-semibold tracking-wide text-slate uppercase">{t(`kinds.${group}`)}</h4>
                  <ul className="flex flex-col divide-y divide-line rounded-button border border-line">
                    {templates.map((template) => (
                      <li className="flex items-center gap-4 px-4 py-2" key={template.key}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink">{libraryName(names, template)}</span>
                          <span className="block text-xs text-slate">
                            {systemsLine(template, t("unnamed"))} · {sizeRange(template)}
                          </span>
                        </span>
                        {taken.has(template.key) ? (
                          <Badge tone="ok">{t("added")}</Badge>
                        ) : (
                          <Button
                            aria-label={t("addFor", { name: libraryName(names, template) })}
                            busy={busy === template.key}
                            onClick={() =>
                              void run(template.key ?? "", () =>
                                readJson("/api/catalog/size-charts", {
                                  method: "POST",
                                  body: JSON.stringify({ templateKey: template.key, name: libraryName(names, template) }),
                                }),
                              )
                            }
                            type="button"
                            variant="secondary"
                          >
                            {t("add")}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })}
          </section>
        </div>
      )}
    </Modal>
  );
}
