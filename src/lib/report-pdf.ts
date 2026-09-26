import type { Report } from '@/data/types';
import { formatMoney, formatQty } from './format';
import { formatDateLong, formatMonth } from './dates';

// jsPDF dimuat hanya saat tombol Unduh PDF ditekan
export async function downloadReportPdf(report: Report, kind: 'daily' | 'monthly'): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const s = report.summary;
  const brand: [number, number, number] = [30, 106, 81];
  const ink: [number, number, number] = [21, 32, 27];
  const muted: [number, number, number] = [94, 106, 100];
  const left = 48;
  const period = kind === 'daily' ? formatDateLong(report.from) : formatMonth(report.from);
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 120;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...ink);
  doc.text(report.business.name, left, 64);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...muted);
  doc.text(`${kind === 'daily' ? 'Laporan harian' : 'Laporan bulanan'}: ${period}`, left, 84);
  if (report.business.address) doc.text(report.business.address, left, 100);

  const section = (title: string, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...ink);
    doc.text(title, left, y);
    return y + 8;
  };

  const common = {
    theme: 'plain' as const,
    margin: { left, right: left },
    styles: { font: 'helvetica', fontSize: 10, textColor: ink, cellPadding: { top: 5, bottom: 5, left: 0, right: 0 } },
    headStyles: { fontStyle: 'bold' as const, textColor: muted },
    columnStyles: { 1: { halign: 'right' as const } },
  };

  autoTable(doc, {
    ...common,
    startY: section('Ringkasan laba', 130),
    body: [
      ['Penjualan (omzet)', formatMoney(s.revenue)],
      ['Modal barang terjual (HPP)', `-${formatMoney(s.cogs)}`],
      ['Laba kotor', formatMoney(s.gross_profit)],
      ['Pengeluaran operasional', `-${formatMoney(s.expenses)}`],
      ['Laba bersih', formatMoney(s.net_profit)],
    ],
    didParseCell: (data) => {
      if (data.row.index === 4) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 12;
        data.cell.styles.textColor = brand;
      }
      if (data.row.index === 2) data.cell.styles.fontStyle = 'bold';
    },
  });

  autoTable(doc, {
    ...common,
    startY: section('Aktivitas', lastY() + 26),
    body: [
      ['Transaksi', String(s.transactions)],
      ['Rata-rata per transaksi', formatMoney(s.avg_ticket)],
      ['Item terjual', formatQty(s.items_sold)],
      ['Diskon diberikan', formatMoney(s.discount)],
      ['Transaksi dibatalkan', `${s.voids} (${formatMoney(s.void_total)})`],
      ['Hutang baru', formatMoney(s.debt_new)],
      ['Hutang dibayar', formatMoney(s.debt_collected)],
      ['Piutang saat ini', formatMoney(s.receivables_now)],
    ],
  });

  const methods = report.by_method.filter((m) => m.kind !== 'debt' && m.total > 0);
  if (methods.length) {
    autoTable(doc, {
      ...common,
      startY: section('Uang masuk per metode', lastY() + 26),
      head: [['Metode', 'Jumlah']],
      body: [...methods.map((m) => [m.name, formatMoney(m.total)]), ['Total uang masuk', formatMoney(s.cash_in)]],
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === methods.length) data.cell.styles.fontStyle = 'bold';
      },
    });
  }

  if (report.top_products.length) {
    autoTable(doc, {
      ...common,
      startY: section('Produk terlaris', lastY() + 26),
      head: [['Produk', 'Terjual', 'Omzet', 'Laba']],
      body: report.top_products.map((p) => [p.name, `${formatQty(p.qty)} ${p.unit}`, formatMoney(p.revenue), formatMoney(p.profit)]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
  }

  if (report.expenses_by_category.length) {
    autoTable(doc, {
      ...common,
      startY: section('Pengeluaran per kategori', lastY() + 26),
      head: [['Kategori', 'Jumlah']],
      body: report.expenses_by_category.map((e) => [`${e.category} (${e.count})`, formatMoney(e.amount)]),
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(`Dibuat dengan Possir. Halaman ${i} dari ${pages}`, left, doc.internal.pageSize.getHeight() - 32);
  }

  const slug = report.business.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`laporan-${slug}-${kind === 'daily' ? report.from : report.from.slice(0, 7)}.pdf`);
}
