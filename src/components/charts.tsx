"use client";

import { useState } from "react";

/** Axis figures, short and in the same digits as every amount in the app: 1,250,000 → "1.3M". */
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** A round top for the axis, so the gridlines fall on easy numbers: 183,000 → 200,000. */
function niceMax(value: number) {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => value <= candidate * magnitude) ?? 10;
  return step * magnitude;
}

export type Column = {
  key: string;
  /** Under the column, when there is room. */
  label: string;
  value: number;
  /** A second figure, drawn as a line across the columns. */
  line?: number;
  highlight?: boolean;
  /** What a hover or a tap shows. */
  detail: React.ReactNode;
  /** The same, as one sentence for a screen reader. */
  spoken: string;
};

/**
 * Columns, with an optional line for a second figure. Hovering or tapping a column shows its
 * figures; a screen reader gets the summary and one sentence per column instead of the drawing.
 */
export function ColumnChart({ columns, summary, labelEvery = 1 }: { columns: Column[]; summary: string; labelEvery?: number }) {
  const [active, setActive] = useState<number>();
  const top = niceMax(Math.max(0, ...columns.flatMap((column) => [column.value, column.line ?? 0])));
  const count = columns.length;
  const hasLine = columns.some((column) => column.line !== undefined);
  const points = columns
    .map((column, index) => `${((index + 0.5) / count) * 100},${100 - ((column.line ?? 0) / top) * 100}`)
    .join(" ");
  const shown = active === undefined ? undefined : columns[active];
  const left = active === undefined ? 0 : Math.min(85, Math.max(15, ((active + 0.5) / count) * 100));

  return (
    <div>
      <div aria-hidden="true" className="flex gap-3">
        <div className="relative h-52 w-10 shrink-0 text-right text-[0.6875rem] text-slate tabular-nums">
          {[0, 1, 2, 3, 4].map((step) => (
            <span className="absolute right-0 -translate-y-1/2" key={step} style={{ top: `${step * 25}%` }}>
              {compact.format(top * (1 - step / 4))}
            </span>
          ))}
        </div>
        <div className="relative h-52 min-w-0 flex-1" onPointerLeave={() => setActive(undefined)}>
          {[0, 1, 2, 3, 4].map((step) => (
            <span
              className={`absolute inset-x-0 border-t border-line ${step === 4 ? "" : "border-dashed"}`}
              key={step}
              style={{ top: `${step * 25}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1.5">
            {columns.map((column, index) => (
              <div
                className="flex h-full min-w-0 flex-1 cursor-default items-end"
                key={column.key}
                onPointerDown={() => setActive(index)}
                onPointerEnter={() => setActive(index)}
              >
                <div
                  className={`w-full rounded-t-md transition-colors motion-reduce:transition-none ${
                    column.highlight ? "bg-navy" : active === index ? "bg-brand" : "bg-brand/65"
                  }`}
                  style={{ height: `${column.value > 0 ? Math.max(2, (column.value / top) * 100) : 0.75}%` }}
                />
              </div>
            ))}
          </div>
          {hasLine ? (
            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              <polyline
                fill="none"
                points={points}
                stroke="var(--teal)"
                strokeLinejoin="round"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : null}
          {shown ? (
            <div
              className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-xl bg-navy px-3 py-2 text-xs whitespace-nowrap text-white shadow-pop"
              style={{ left: `${left}%` }}
            >
              {shown.detail}
            </div>
          ) : null}
        </div>
      </div>
      <div aria-hidden="true" className="mt-2 ml-[3.25rem] flex gap-[3px] text-center text-[0.6875rem] text-slate tabular-nums sm:gap-1.5">
        {columns.map((column, index) => (
          <span className="min-w-0 flex-1 truncate" key={column.key}>
            {index % labelEvery === 0 || index === count - 1 ? column.label : ""}
          </span>
        ))}
      </div>
      <div className="sr-only">
        <p>{summary}</p>
        <ul>
          {columns.map((column) => (
            <li key={column.key}>{column.spoken}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export type Slice = { key: string; value: number; color: string };

/** A ring of shares, with whatever the caller puts in its middle. */
export function Donut({ slices, children }: { slices: Slice[]; children?: React.ReactNode }) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const drawn = slices.filter((slice) => slice.value > 0);
  // where each slice starts, in hundredths of the ring
  const starts = drawn.reduce<number[]>((list, slice, index) => {
    list.push(index === 0 ? 0 : list[index - 1] + (drawn[index - 1].value / total) * 100);
    return list;
  }, []);
  return (
    <div className="relative mx-auto size-44 shrink-0">
      <svg aria-hidden="true" className="size-full -rotate-90" viewBox="0 0 42 42">
        <circle cx="21" cy="21" fill="none" r="15.915" stroke="var(--line)" strokeWidth="5" />
        {total > 0
          ? drawn.map((slice, index) => {
              const share = (slice.value / total) * 100;
              // a hair of white between neighbours, none when one slice is the whole ring
              const length = drawn.length > 1 ? Math.max(0, share - 0.8) : share;
              return (
                <circle
                  cx="21"
                  cy="21"
                  fill="none"
                  key={slice.key}
                  r="15.915"
                  stroke={slice.color}
                  strokeDasharray={`${length} ${100 - length}`}
                  strokeDashoffset={-starts[index]}
                  strokeWidth="5"
                />
              );
            })
          : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">{children}</div>
    </div>
  );
}
