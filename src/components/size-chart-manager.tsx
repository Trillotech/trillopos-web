"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { PlusIcon } from "@/components/icons";
import { libraryName } from "@/components/size-chart-select";
import { Alert, Badge, Button, ConfirmButton, Field, Modal, SelectField, TextArea } from "@/components/ui";
import { messageFor, readJson } from "@/lib/read-json";
import { parseLabels, sizeChartKinds, type SizeChart, type SizeChartKind, type SizeChartTemplate } from "@/lib/size-charts";

/** "35, 35.5, 36 … 48": enough of a chart to recognise it. */
function preview(labels: string[] = []) {
  return labels.length > 5 ? `${labels.slice(0, 3).join(", ")} … ${labels[labels.length - 1]}` : labels.join(", ");
}

/**
 * The shop's size charts: take one from the library, type one, change the sizes of either, delete
 * one. Products already made keep the names and sizes they were made with.
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
  const [shortName, setShortName] = useState("");
  const [kind, setKind] = useState<SizeChartKind>("OTHER");
  const [labels, setLabels] = useState("");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const taken = new Set(charts.map((chart) => chart.templateKey).filter(Boolean));

  function edit(chart: SizeChart | "new") {
    setError(undefined);
    setName(chart === "new" ? "" : (chart.name ?? ""));
    setShortName(chart === "new" ? "" : (chart.shortName ?? ""));
    setKind(chart === "new" ? "OTHER" : (chart.kind ?? "OTHER"));
    setLabels(chart === "new" ? "" : (chart.labels ?? []).join(", "));
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
    const sizes = parseLabels(labels);
    if (!name.trim() || sizes.length === 0) {
      setError(t(name.trim() ? "labelsRequired" : "nameRequired"));
      return;
    }
    const body = JSON.stringify({ name, shortName, kind, labels: sizes });
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
          <Field label={t("name")} maxLength={80} onChange={(event) => setName(event.target.value)} required value={name} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field hint={t("shortNameHint")} label={t("shortName")} maxLength={10} onChange={(event) => setShortName(event.target.value)} value={shortName} />
            <SelectField label={t("kind")} onChange={(event) => setKind(event.target.value as SizeChartKind)} value={kind}>
              {sizeChartKinds.map((value) => (
                <option key={value} value={value}>
                  {t(`kinds.${value}`)}
                </option>
              ))}
            </SelectField>
          </div>
          <TextArea hint={t("labelsHint")} label={t("labels")} onChange={(event) => setLabels(event.target.value)} required value={labels} />
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
                        {t("count", { count: chart.labels?.length ?? 0 })} · {preview(chart.labels)}
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
                          <span className="block truncate text-xs text-slate">{preview(template.labels)}</span>
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
