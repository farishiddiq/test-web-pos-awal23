import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/util';
import { formatCompact } from '@/lib/format';

export interface ColumnDatum {
  key: string;
  /** label sumbu x (singkat) */
  label: string;
  /** label lengkap untuk tooltip dan tabel */
  title: string;
  value: number;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/** Kolom membulat 4px di ujung data, persegi di garis dasar */
function columnPath(x: number, y: number, w: number, base: number): string {
  const h = base - y;
  const r = Math.min(4, w / 2, h);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

/**
 * Grafik kolom satu seri. Bentuk "emphasis": satu kolom disorot warna brand,
 * sisanya abu-abu sebagai konteks. Tooltip saat hover/fokus, tabel untuk pembaca layar.
 */
export function ColumnChart({
  data,
  highlightKey,
  height = 160,
  format,
  showAxis = false,
  labelEvery = 1,
  labelHighlight = false,
  caption,
  className,
}: {
  data: ColumnDatum[];
  highlightKey?: string | null;
  height?: number;
  format: (value: number) => string;
  showAxis?: boolean;
  labelEvery?: number;
  /** tampilkan nilai kolom yang disorot tanpa perlu hover */
  labelHighlight?: boolean;
  caption: string;
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();

  const axisW = showAxis ? 40 : 0;
  const labelH = 22;
  const topPad = 24;
  const plotW = Math.max(width - axisW, 0);
  const plotH = height - labelH - topPad;
  const base = topPad + plotH;
  const maxValue = Math.max(0, ...data.map((d) => d.value));
  const max = showAxis ? niceMax(maxValue) : Math.max(maxValue, 1);
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(3, Math.min(24, band * 0.62));
  const highlightIndex = highlightKey ? data.findIndex((d) => d.key === highlightKey) : -1;
  const startIndex = highlightIndex >= 0 ? highlightIndex : null;
  const shown = active ?? (labelHighlight ? startIndex : null);

  const yOf = (v: number) => (v <= 0 ? base : Math.min(base - 2, base - (v / max) * plotH));
  const ticks = showAxis ? [0, max / 2, max] : [];

  return (
    <figure className={cn('relative', className)}>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={caption}
            aria-describedby={tableId}
            tabIndex={0}
            className="block overflow-visible rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-brand"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                setActive((i) => Math.min(data.length - 1, i === null ? (startIndex ?? -1) + 1 : i + 1));
              }
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setActive((i) => Math.max(0, i === null ? (startIndex ?? data.length) - 1 : i - 1));
              }
            }}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={axisW} x2={width} y1={yOf(t) + 0.5} y2={yOf(t) + 0.5} stroke="var(--line)" strokeWidth={1} />
                <text x={axisW - 8} y={yOf(t) + 4} textAnchor="end" className="fill-ink-3 text-[11px] tabular">
                  {formatCompact(t)}
                </text>
              </g>
            ))}
            {!showAxis && <line x1={0} x2={width} y1={base + 0.5} y2={base + 0.5} stroke="var(--line)" strokeWidth={1} />}
            {data.map((d, i) => {
              const x = axisW + i * band + (band - barW) / 2;
              const y = yOf(d.value);
              const emphasized = highlightIndex < 0 ? true : i === highlightIndex;
              const isActive = shown === i;
              return (
                <g key={d.key}>
                  {d.value > 0 && (
                    <path
                      d={columnPath(x, y, barW, base)}
                      fill={emphasized ? 'var(--brand)' : 'var(--chart-muted)'}
                      opacity={active !== null && !isActive ? 0.55 : 1}
                    />
                  )}
                  {(i % labelEvery === 0 || i === data.length - 1 || i === highlightIndex) && (
                    <text
                      x={axisW + i * band + band / 2}
                      y={height - 5}
                      textAnchor="middle"
                      className={cn('text-[11px]', i === highlightIndex ? 'fill-ink font-bold' : 'fill-ink-3')}
                    >
                      {d.label}
                    </text>
                  )}
                  {/* area sentuh selebar pita, lebih besar dari kolomnya */}
                  <rect
                    x={axisW + i * band}
                    y={0}
                    width={band}
                    height={base}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                    onPointerDown={() => setActive(i)}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {shown !== null && data[shown] && width > 0 && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-ink px-2.5 py-1.5 text-center text-canvas shadow-[var(--shadow-float)]"
            style={{
              left: Math.min(Math.max(axisW + shown * band + band / 2, 56), width - 56),
              top: Math.max(0, yOf(data[shown].value) - 44),
            }}
          >
            <div className="text-[13px] font-bold tabular">{format(data[shown].value)}</div>
            <div className="text-[11px] opacity-75">{data[shown].title}</div>
          </div>
        )}
      </div>
      <table id={tableId} className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.title}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Bar horizontal satu warna untuk perbandingan dalam daftar (metode bayar, kategori) */
export function InlineBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className={cn('h-1.5 w-full', className)} aria-hidden>
      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </div>
  );
}
