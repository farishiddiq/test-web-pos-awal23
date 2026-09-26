// Semua tanggal usaha dihitung di zona waktu usaha (default Africa/Cairo),
// bukan zona waktu HP, supaya "hari ini" sama dengan yang dihitung database.
export const DEFAULT_TZ = 'Africa/Cairo';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** "2026-09-26" di zona waktu tertentu */
export function dateKey(input: Date | string, tz: string = DEFAULT_TZ): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function todayKey(tz: string = DEFAULT_TZ): string {
  return dateKey(new Date(), tz);
}

function parts(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

function keyToUtc(key: string): Date {
  const { y, m, d } = parts(key);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function utcToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: string, n: number): string {
  const d = keyToUtc(key);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToKey(d);
}

export function startOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonth(key: string): string {
  const { y, m } = parts(key);
  return utcToKey(new Date(Date.UTC(y, m, 0, 12)));
}

export function addMonths(key: string, n: number): string {
  const { y, m } = parts(key);
  return utcToKey(new Date(Date.UTC(y, m - 1 + n, 1, 12)));
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToUtc(toKey).getTime() - keyToUtc(fromKey).getTime()) / 86_400_000);
}

export function weekdayIndex(key: string): number {
  return keyToUtc(key).getUTCDay();
}

/** "Sabtu, 26 September 2026" */
export function formatDateLong(key: string): string {
  const { y, m, d } = parts(key);
  return `${DAYS[weekdayIndex(key)]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Sabtu, 26 September" */
export function formatDayMonth(key: string, withWeekday = true): string {
  const { m, d } = parts(key);
  return withWeekday ? `${DAYS[weekdayIndex(key)]}, ${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]}`;
}

/** "26 Sep 2026" */
export function formatDateMedium(key: string): string {
  const { y, m, d } = parts(key);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "26 Sep" */
export function formatDateShort(key: string): string {
  const { m, d } = parts(key);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function weekdayShort(key: string): string {
  return DAYS_SHORT[weekdayIndex(key)];
}

/** "September 2026" dari "2026-09" atau "2026-09-26" */
export function formatMonth(key: string): string {
  const { y, m } = parts(key.length === 7 ? `${key}-01` : key);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatTime(iso: string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(iso))
    .replace('.', ':');
}

/** "26 Sep, 10:32" */
export function formatDateTime(iso: string, tz: string = DEFAULT_TZ): string {
  return `${formatDateShort(dateKey(iso, tz))}, ${formatTime(iso, tz)}`;
}

/** "Hari ini", "Kemarin", atau "Sabtu, 20 September" */
export function relativeDayLabel(key: string, today: string): string {
  if (key === today) return 'Hari ini';
  if (key === addDays(today, -1)) return 'Kemarin';
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return sameYear ? formatDayMonth(key) : formatDateLong(key);
}

/** "3 hari", "2 minggu", untuk umur hutang */
export function ageLabel(fromIso: string, tz: string = DEFAULT_TZ): string {
  const days = daysBetween(dateKey(fromIso, tz), todayKey(tz));
  if (days <= 0) return 'hari ini';
  if (days === 1) return 'kemarin';
  if (days < 14) return `${days} hari`;
  if (days < 60) return `${Math.floor(days / 7)} minggu`;
  return `${Math.floor(days / 30)} bulan`;
}

/** "belum bayar sejak kemarin", "belum bayar 9 hari", "belum bayar 3 minggu" */
export function unpaidLabel(fromIso: string, tz: string = DEFAULT_TZ): string {
  const days = daysBetween(dateKey(fromIso, tz), todayKey(tz));
  if (days <= 0) return 'hutang hari ini';
  if (days === 1) return 'belum bayar sejak kemarin';
  if (days < 14) return `belum bayar ${days} hari`;
  if (days < 60) return `belum bayar ${Math.floor(days / 7)} minggu`;
  return `belum bayar ${Math.floor(days / 30)} bulan`;
}

export function greeting(tz: string = DEFAULT_TZ): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date()));
  if (hour < 4) return 'Selamat malam';
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}
