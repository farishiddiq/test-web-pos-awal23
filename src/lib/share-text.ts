// Teks untuk dikirim lewat WhatsApp. *tebal* dan baris baru mengikuti format WhatsApp.
import { formatMoney, formatQty } from './format';
import { roundMoney } from './util';
import { dateKey, formatDateLong, formatDateMedium, formatMonth, formatTime } from './dates';
import type { Business, Report, Sale } from '@/data/types';

export const DEFAULT_REMINDER_TEMPLATE =
  "Assalamu'alaikum {nama}, catatan pembayaran kamu di {toko} masih tersisa {sisa}. Kalau sudah bayar, abaikan pesan ini ya. Terima kasih.";

export function fillReminder(template: string | null | undefined, vars: { nama: string; toko: string; sisa: number }): string {
  return (template?.trim() || DEFAULT_REMINDER_TEMPLATE)
    .replaceAll('{nama}', vars.nama)
    .replaceAll('{toko}', vars.toko)
    .replaceAll('{sisa}', formatMoney(vars.sisa));
}

export function saleReceiptText(sale: Sale, business: Business): string {
  const tz = business.timezone;
  const lines: string[] = [];
  lines.push(`*${business.name}*`);
  lines.push(`Struk #${sale.number}, ${formatDateMedium(dateKey(sale.created_at, tz))} ${formatTime(sale.created_at, tz)}`);
  if (sale.status === 'void') lines.push('_Transaksi ini sudah dibatalkan_');
  lines.push('');
  for (const item of sale.items) {
    lines.push(`${item.name}`);
    lines.push(`  ${formatQty(item.qty)} × ${formatMoney(item.unit_price)} = ${formatMoney(item.line_total)}`);
  }
  lines.push('');
  if (sale.discount > 0) {
    lines.push(`Subtotal: ${formatMoney(sale.subtotal)}`);
    lines.push(`Diskon: -${formatMoney(sale.discount)}`);
  }
  lines.push(`*Total: ${formatMoney(sale.total)}*`);
  for (const p of sale.payments) {
    lines.push(p.method_kind === 'debt' ? `Sisa hutang: ${formatMoney(p.amount)}` : `Bayar ${p.method_name}: ${formatMoney(p.amount)}`);
  }
  if (sale.cash_received && sale.cash_received > sale.total) {
    lines.push(`Uang diterima: ${formatMoney(sale.cash_received)}`);
    lines.push(`Kembalian: ${formatMoney(roundMoney(sale.cash_received - sale.total))}`);
  }
  if (sale.due_date) lines.push(`Jatuh tempo: ${formatDateMedium(sale.due_date)}`);
  lines.push('');
  lines.push(business.receipt_footer?.trim() || 'Terima kasih!');
  return lines.join('\n');
}

export function reportText(report: Report, kind: 'daily' | 'monthly'): string {
  const s = report.summary;
  const period = kind === 'daily' ? formatDateLong(report.from) : formatMonth(report.from);
  const lines: string[] = [];
  lines.push(`*Laporan ${report.business.name}*`);
  lines.push(period);
  lines.push('');
  lines.push(`Penjualan: ${formatMoney(s.revenue)} (${s.transactions} transaksi)`);
  lines.push(`Modal (HPP): ${formatMoney(s.cogs)}`);
  lines.push(`Laba kotor: ${formatMoney(s.gross_profit)}`);
  lines.push(`Pengeluaran: ${formatMoney(s.expenses)}`);
  lines.push(`*Laba bersih: ${formatMoney(s.net_profit)}*`);
  const cashIn = report.by_method.filter((m) => m.kind !== 'debt' && m.total > 0);
  if (cashIn.length) {
    lines.push('');
    lines.push('*Uang masuk*');
    for (const m of cashIn) lines.push(`• ${m.name}: ${formatMoney(m.total)}`);
  }
  if (s.debt_new > 0 || s.debt_collected > 0) {
    lines.push('');
    lines.push(`Hutang baru: ${formatMoney(s.debt_new)}`);
    lines.push(`Hutang dibayar: ${formatMoney(s.debt_collected)}`);
  }
  if (report.top_products.length) {
    lines.push('');
    lines.push('*Produk terlaris*');
    report.top_products.slice(0, 3).forEach((p, i) => lines.push(`${i + 1}. ${p.name} (${formatQty(p.qty)} ${p.unit})`));
  }
  lines.push('');
  lines.push('Dibuat dengan Possir');
  return lines.join('\n');
}
