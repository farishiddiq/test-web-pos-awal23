import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, CaretLeft, CaretRight, ChartBar, Coins, FilePdf, Receipt, ShoppingBagOpen, Tag, WhatsappLogo } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Page } from '@/components/layout/app-shell';
import { Button, IconButton } from '@/components/ui/button';
import { Segmented } from '@/components/ui/choice';
import { EmptyState, ErrorState, Money, PageHeader, Row, SectionCard, Skeleton, StatTile } from '@/components/ui/display';
import { ColumnChart, InlineBar } from '@/components/charts/column-chart';
import { CashFlowCard } from '@/components/cashflow/cash-flow-card';
import { expenseIcon } from '@/features/pengeluaran/expense-sheet';
import { useBusiness } from '@/data/business';
import { useReport } from '@/data/queries';
import type { Report } from '@/data/types';
import { addDays, addMonths, endOfMonth, formatDateLong, formatDayMonth, formatMonth, startOfMonth } from '@/lib/dates';
import { formatCount, formatMoney, formatQty } from '@/lib/format';
import { reportText } from '@/lib/share-text';
import { openWhatsApp } from '@/lib/phone';
import { cn } from '@/lib/util';

type Kind = 'daily' | 'monthly';

export function LaporanPage() {
  const { today } = useBusiness();
  const [kind, setKind] = useState<Kind>('daily');
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(startOfMonth(today));
  const [pdfBusy, setPdfBusy] = useState(false);

  const isCurrentMonth = month === startOfMonth(today);
  const from = kind === 'daily' ? day : month;
  const to = kind === 'daily' ? day : isCurrentMonth ? today : endOfMonth(month);
  const query = useReport(from, to);
  const report = query.data;
  const canNext = kind === 'daily' ? day < today : !isCurrentMonth;

  const step = (dir: -1 | 1) => (kind === 'daily' ? setDay(addDays(day, dir)) : setMonth(addMonths(month, dir)));
  const label = kind === 'daily' ? formatDateLong(day) : formatMonth(month);

  const exportPdf = async () => {
    if (!report) return;
    setPdfBusy(true);
    try {
      const { downloadReportPdf } = await import('@/lib/report-pdf');
      await downloadReportPdf(report, kind);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF gagal dibuat.');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Laporan"
        subtitle="Laba, uang masuk, dan produk terlaris"
        actions={
          <>
            <Button variant="secondary" icon={<WhatsappLogo size={18} weight="fill" />} disabled={!report} onClick={() => report && openWhatsApp(reportText(report, kind))}>
              <span className="max-sm:hidden">Bagikan ke </span>WhatsApp
            </Button>
            <Button variant="secondary" icon={<FilePdf size={18} />} disabled={!report} loading={pdfBusy} loadingText="Membuat…" onClick={exportPdf}>
              PDF
            </Button>
          </>
        }
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Segmented
          label="Jenis laporan"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'daily', label: 'Harian' },
            { value: 'monthly', label: 'Bulanan' },
          ]}
        />
        <div className="flex items-center gap-2">
          <IconButton label={kind === 'daily' ? 'Hari sebelumnya' : 'Bulan sebelumnya'} variant="outline" onClick={() => step(-1)}>
            <CaretLeft size={18} weight="bold" />
          </IconButton>
          <label className="relative">
            <span className="sr-only">Pilih {kind === 'daily' ? 'tanggal' : 'bulan'}</span>
            <span className="pointer-events-none block min-w-[190px] text-center text-[15px] font-bold" aria-hidden>
              {label}
            </span>
            {kind === 'daily' ? (
              <input type="date" max={today} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
            ) : (
              <input
                type="month"
                max={today.slice(0, 7)}
                value={month.slice(0, 7)}
                onChange={(e) => e.target.value && setMonth(`${e.target.value}-01`)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            )}
          </label>
          <IconButton label={kind === 'daily' ? 'Hari berikutnya' : 'Bulan berikutnya'} variant="outline" disabled={!canNext} onClick={() => step(1)}>
            <CaretRight size={18} weight="bold" />
          </IconButton>
        </div>
      </div>

      {query.isPending ? (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Skeleton className="h-80 rounded-[24px] lg:col-span-5" />
          <Skeleton className="h-80 rounded-[24px] lg:col-span-7" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : report ? (
        <div className={cn('transition-opacity', query.isFetching && query.isPlaceholderData && 'opacity-60')}>
          <ReportBody report={report} kind={kind} />
        </div>
      ) : null}
    </Page>
  );
}

function ReportBody({ report, kind }: { report: Report; kind: Kind }) {
  const s = report.summary;
  const empty = s.transactions === 0 && s.expenses === 0 && s.voids === 0;
  if (empty) {
    return (
      <div className="card mt-5">
        <EmptyState icon={<ChartBar size={26} />} title="Belum ada data di periode ini">
          Transaksi dan pengeluaran yang dicatat akan langsung masuk ke laporan.
        </EmptyState>
      </div>
    );
  }
  const maxExpense = Math.max(0, ...report.expenses_by_category.map((e) => e.amount));

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
      <section className="card p-5 md:p-6 lg:col-span-5" aria-labelledby="net-profit">
        <p id="net-profit" className="text-[14px] font-semibold text-ink-3">
          Laba bersih
        </p>
        <Money value={s.net_profit} className={cn('mt-1 block text-[44px] font-bold leading-none tracking-[-0.035em]', s.net_profit < 0 && 'text-danger')} />
        <p className="mt-2 text-[13px] text-ink-3">Setelah modal barang dan pengeluaran operasional. Belanja stok tidak dikurangi dua kali: sudah masuk lewat modal barang saat terjual.</p>
        <div className="mt-6 rounded-[18px] bg-surface-2 px-4 py-2">
          <Row label="Penjualan (omzet)" value={<Money value={s.revenue} />} />
          <Row label="Modal barang (HPP)" value={<Money value={-s.cogs} />} muted />
          <Row label="Laba kotor" value={<Money value={s.gross_profit} />} strong className="border-t border-dashed border-line pt-2.5" />
          <Row label="Pengeluaran" value={<Money value={-s.expenses} />} muted />
          <Row label="Laba bersih" value={<Money value={s.net_profit} />} strong className="border-t border-dashed border-line pt-2.5" />
        </div>
        {s.revenue > 0 && (
          <p className="mt-3 text-[13px] text-ink-3">
            Margin laba kotor {Math.round((s.gross_profit / s.revenue) * 100)}%, laba bersih {Math.round((s.net_profit / s.revenue) * 100)}% dari omzet.
          </p>
        )}
      </section>

      <div className="grid min-w-0 grid-cols-1 content-start gap-4 lg:col-span-7">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile color="mint" icon={<Receipt size={16} weight="bold" />} label="Transaksi" value={formatCount(s.transactions)} footer={s.voids ? `${s.voids} dibatalkan` : 'Tidak ada yang batal'} />
          <StatTile color="sky" icon={<Coins size={16} weight="bold" />} label="Rata-rata" value={<Money value={s.avg_ticket} />} footer="Per transaksi" />
          <StatTile color="lime" icon={<ShoppingBagOpen size={16} weight="bold" />} label="Item terjual" value={formatQty(s.items_sold)} />
          <StatTile color="sand" icon={<Tag size={16} weight="bold" />} label="Diskon" value={<Money value={s.discount} />} />
        </div>
        <SalesChartCard report={report} kind={kind} />
      </div>

      <CashFlowCard from={report.from} to={report.to} className="lg:col-span-6" />

      <SectionCard title="Piutang" className="lg:col-span-6" action={<Link to="/piutang" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">Kelola <ArrowRight size={14} weight="bold" /></Link>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[18px] p-4" style={{ background: 'var(--tint-peach-bg)' }}>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--tint-peach-fg)' }}>
              Hutang baru
            </p>
            <Money value={s.debt_new} className="mt-1 block text-[20px] font-bold" />
          </div>
          <div className="rounded-[18px] p-4" style={{ background: 'var(--tint-mint-bg)' }}>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--tint-mint-fg)' }}>
              Dibayar
            </p>
            <Money value={s.debt_collected} className="mt-1 block text-[20px] font-bold" />
          </div>
        </div>
        <Row label="Total piutang saat ini" value={<Money value={s.receivables_now} />} strong className="mt-3" />
        {s.purchases > 0 && <Row label="Belanja stok ke supplier" value={<Money value={s.purchases} />} muted />}
      </SectionCard>

      <SectionCard title="Produk terlaris" className="lg:col-span-7" padded={false}>
        {report.top_products.length === 0 ? (
          <p className="px-5 pb-5 text-[14px] text-ink-3">Belum ada produk terjual.</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <table className="w-full min-w-[460px] text-[14px]">
              <thead>
                <tr className="border-b border-line text-left text-[12.5px] font-semibold text-ink-3">
                  <th scope="col" className="px-5 py-2.5 font-semibold">Produk</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Terjual</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Omzet</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Laba</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.top_products.map((p, i) => (
                  <tr key={`${p.product_id ?? p.name}`}>
                    <td className="px-5 py-2.5">
                      <span className="mr-2 text-[12.5px] font-bold text-ink-3 tabular">{i + 1}</span>
                      <span className="font-semibold">{p.name}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular">
                      {formatQty(p.qty)} <span className="text-ink-3">{p.unit}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular">{formatMoney(p.revenue)}</td>
                    <td className={cn('px-5 py-2.5 text-right font-semibold tabular', p.profit < 0 ? 'text-danger' : 'text-brand')}>{formatMoney(p.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Pengeluaran" className="lg:col-span-5" action={<Link to="/pengeluaran" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">Rincian <ArrowRight size={14} weight="bold" /></Link>}>
        <Money value={s.expenses} className="block text-[28px] font-bold tracking-[-0.03em]" />
        {report.expenses_by_category.length === 0 ? (
          <p className="mt-1 text-[14px] text-ink-3">Tidak ada pengeluaran tercatat.</p>
        ) : (
          <ul className="mt-4 grid gap-3.5">
            {report.expenses_by_category.map((e) => {
              const I = expenseIcon(e.category);
              return (
                <li key={e.category} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                  <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-ink-2">
                    <I size={15} aria-hidden />
                  </span>
                  <span className="truncate text-[14px] font-semibold">{e.category}</span>
                  <Money value={e.amount} tabular className="text-[14px] font-semibold" />
                  <span />
                  <InlineBar value={e.amount} max={maxExpense} className="col-span-2" />
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function SalesChartCard({ report, kind }: { report: Report; kind: Kind }) {
  const { data, best, title } = useMemo(() => {
    if (kind === 'monthly') {
      const series = report.series.map((d) => ({
        key: d.date,
        label: String(Number(d.date.slice(8, 10))),
        title: formatDayMonth(d.date),
        value: d.revenue,
      }));
      const top = series.reduce<(typeof series)[number] | null>((b, d) => (d.value > (b?.value ?? 0) ? d : b), null);
      return { data: series, best: top, title: 'Penjualan per hari' };
    }
    const hours = report.by_hour;
    if (hours.length === 0) return { data: [], best: null, title: 'Jam ramai' };
    const min = Math.min(...hours.map((h) => h.hour));
    const max = Math.max(...hours.map((h) => h.hour));
    const series = Array.from({ length: max - min + 1 }, (_, i) => {
      const hour = min + i;
      const h = hours.find((x) => x.hour === hour);
      return { key: String(hour), label: `${String(hour).padStart(2, '0')}`, title: `Jam ${String(hour).padStart(2, '0')}.00`, value: h?.revenue ?? 0 };
    });
    const top = series.reduce<(typeof series)[number] | null>((b, d) => (d.value > (b?.value ?? 0) ? d : b), null);
    return { data: series, best: top, title: 'Jam ramai' };
  }, [report, kind]);

  return (
    <SectionCard
      title={title}
      action={best ? <span className="text-[13px] text-ink-3">Tertinggi: <b className="text-ink-2">{best.title}</b></span> : undefined}
    >
      {data.length === 0 ? (
        <p className="text-[14px] text-ink-3">Belum ada penjualan.</p>
      ) : (
        <ColumnChart
          data={data}
          highlightKey={best?.key ?? null}
          labelHighlight
          showAxis
          height={200}
          labelEvery={kind === 'monthly' ? 5 : 2}
          format={(v) => formatMoney(v)}
          caption={kind === 'monthly' ? 'Penjualan per hari bulan ini' : 'Penjualan per jam'}
        />
      )}
    </SectionCard>
  );
}
