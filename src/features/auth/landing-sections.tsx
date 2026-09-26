import { useState, type ReactNode } from 'react';
import {
  Bank,
  CashRegister,
  ChartBar,
  ChatCircleText,
  DeviceMobile,
  HandCoins,
  Money as MoneyIcon,
  Package,
  Quotes,
} from '@phosphor-icons/react';
import { Avatar } from '@/components/ui/display';
import { cn } from '@/lib/util';
import { TESTIMONIALS } from './testimonials';

// Screenshot asli dari mode demo (npm run screenshots), disimpan di public/screens

/** Bingkai tipis untuk screenshot layar lebar */
export function DesktopShot({ src, alt, eager, className }: { src: string; alt: string; eager?: boolean; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-[22px] border border-line bg-surface p-1.5 shadow-[var(--shadow-float)]', className)}>
      <img
        src={src}
        alt={alt}
        width={1440}
        height={900}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
        className="block h-auto w-full rounded-[16px]"
      />
    </div>
  );
}

/** Bingkai HP untuk screenshot 390 x 844 */
export function PhoneShot({ src, alt, eager, className }: { src: string; alt: string; eager?: boolean; className?: string }) {
  return (
    <div className={cn('rounded-[42px] bg-ink p-[7px] shadow-[var(--shadow-float)] dark:bg-surface-3', className)}>
      <img
        src={src}
        alt={alt}
        width={390}
        height={844}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="block h-auto w-full rounded-[35px]"
      />
    </div>
  );
}

/** Tepat di bawah hero: dashboard asli di laptop dan HP */
export function Showcase() {
  return (
    <section aria-label="Tampilan Possir" className="mx-auto max-w-[1200px] px-5 md:px-8">
      <div className="grid grid-cols-1 items-end gap-6 md:grid-cols-[minmax(0,1fr)_220px] lg:grid-cols-[minmax(0,1fr)_250px] lg:gap-8">
        <DesktopShot
          src="/screens/dashboard-desktop.webp"
          alt="Dashboard Possir: penjualan hari ini, grafik 7 hari, laba kotor, uang masuk, pengeluaran, dan arus kas"
          eager
        />
        <PhoneShot
          src="/screens/dashboard-mobile.webp"
          alt="Dashboard Possir di HP"
          className="mx-auto w-[220px] max-md:hidden lg:w-[250px] md:-mb-10"
        />
      </div>
    </section>
  );
}

type TabKey = 'kasir' | 'piutang' | 'stok' | 'laporan';

const TABS: Array<{
  key: TabKey;
  icon: typeof CashRegister;
  title: string;
  body: string;
  shot: { src: string; alt: string; phone?: boolean };
}> = [
  {
    key: 'kasir',
    icon: CashRegister,
    title: 'Kasir yang cepat',
    body: 'Ketuk produk, pilih cara bayar, selesai. Kembalian dihitung sendiri, hutang bisa pakai uang muka.',
    shot: { src: '/screens/kasir-desktop.webp', alt: 'Halaman kasir Possir dengan katalog produk dan panel pesanan' },
  },
  {
    key: 'piutang',
    icon: HandCoins,
    title: 'Hutang teman tercatat',
    body: 'Buku kas bon per pelanggan, bayar sebagian, dan pengingat WhatsApp dengan satu ketukan.',
    shot: { src: '/screens/piutang-mobile.webp', alt: 'Halaman piutang Possir di HP', phone: true },
  },
  {
    key: 'stok',
    icon: Package,
    title: 'Stok berkurang otomatis',
    body: 'Setiap penjualan mengurangi stok. Barang yang menipis langsung ditandai supaya sempat belanja.',
    shot: { src: '/screens/produk-mobile.webp', alt: 'Daftar produk dan stok Possir di HP', phone: true },
  },
  {
    key: 'laporan',
    icon: ChartBar,
    title: 'Laba bersih, bukan tebakan',
    body: 'Omzet, modal, pengeluaran, dan sisa uang per metode bayar. Kirim ke WhatsApp atau simpan PDF.',
    shot: { src: '/screens/laporan-desktop.webp', alt: 'Laporan bulanan Possir dengan laba bersih dan arus kas' },
  },
];

/** Fitur utama: pilih di kiri, screenshot asli di kanan */
export function FeatureTour() {
  const [active, setActive] = useState<TabKey>('kasir');
  return (
    <section id="fitur" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 pt-24 md:px-8 md:pt-32">
      <h2 className="max-w-[18ch] text-[30px] font-bold leading-[1.1] tracking-[-0.03em] md:text-[40px]">
        Semua yang dicatat usaha kecil, di satu HP.
      </h2>
      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-12">
        <div role="tablist" aria-label="Fitur Possir" aria-orientation="vertical" className="grid content-start gap-2">
          {TABS.map((t) => {
            const on = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={on}
                aria-controls={`panel-${t.key}`}
                onClick={() => setActive(t.key)}
                className={cn(
                  'pressable grid grid-cols-[40px_minmax(0,1fr)] gap-x-3.5 rounded-[22px] p-4 text-left transition-colors duration-200',
                  on ? 'bg-surface shadow-[var(--shadow-card)]' : 'hover:bg-surface/60',
                )}
              >
                <span className={cn('grid size-10 place-items-center rounded-full', on ? 'bg-lime text-on-lime' : 'bg-surface-2 text-ink-2')}>
                  <t.icon size={20} weight={on ? 'fill' : 'regular'} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[16px] font-bold text-ink">{t.title}</span>
                  <span className={cn('mt-1 block text-[14px] leading-relaxed text-ink-2', !on && 'max-lg:hidden')}>{t.body}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-0">
          {TABS.map((t) => (
            <div
              key={t.key}
              role="tabpanel"
              id={`panel-${t.key}`}
              aria-labelledby={`tab-${t.key}`}
              hidden={t.key !== active}
              className="tour-panel grid min-h-[420px] place-items-center rounded-[28px] p-5 md:p-8"
              style={{ background: 'var(--tint-mint-bg)' }}
            >
              {t.shot.phone ? (
                <PhoneShot src={t.shot.src} alt={t.shot.alt} className="w-[min(280px,80%)]" />
              ) : (
                <DesktopShot src={t.shot.src} alt={t.shot.alt} className="w-full" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Detail yang khas Mesir, dalam bento tiga sel */
export function EgyptDetails() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 pt-24 md:px-8 md:pt-32">
      <h2 className="max-w-[20ch] text-[30px] font-bold leading-[1.1] tracking-[-0.03em] md:text-[40px]">Dibuat untuk cara jualan Masisir.</h2>
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-[auto_auto]">
        <article className="rounded-[var(--radius-card)] p-6 md:col-span-4" style={{ background: 'var(--tint-lime-bg)' }}>
          <h3 className="text-[19px] font-bold">Semua dalam EGP, cara bayar Mesir</h3>
          <p className="mt-1.5 max-w-[46ch] text-[14.5px] text-ink-2">Aktifkan yang kamu pakai saja. Laporan memisahkan uang di laci dan saldo tiap dompet.</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {(
              [
                [MoneyIcon, 'Cash'],
                [Bank, 'InstaPay'],
                [DeviceMobile, 'Vodafone Cash'],
                [DeviceMobile, 'Orange Cash'],
                [DeviceMobile, 'Etisalat Cash'],
                [Bank, 'Transfer bank'],
                [HandCoins, 'Hutang'],
              ] as const
            ).map(([I, label]) => (
              <li key={label} className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-3.5 text-[14px] font-semibold text-ink">
                <I size={17} aria-hidden /> {label}
              </li>
            ))}
          </ul>
        </article>

        <article className="card flex flex-col items-center overflow-hidden px-6 pt-6 md:col-span-2 md:row-span-2">
          <h3 className="self-start text-[19px] font-bold">Pasang seperti aplikasi</h3>
          <p className="mt-1.5 self-start text-[14.5px] text-ink-2">Tambahkan ke layar utama dari Chrome. Tanpa Play Store, tanpa mesin kasir.</p>
          <PhoneShot src="/screens/kasir-mobile.webp" alt="Kasir Possir di HP" className="-mb-24 mt-8 w-[min(240px,78%)]" />
        </article>

        <article className="rounded-[var(--radius-card)] p-6 md:col-span-4" style={{ background: 'var(--tint-sky-bg)' }}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,300px)] sm:items-center">
            <div>
              <h3 className="text-[19px] font-bold">Laporan langsung ke WhatsApp</h3>
              <p className="mt-1.5 max-w-[40ch] text-[14.5px] text-ink-2">Ringkasan harian atau bulanan siap dikirim ke partner usaha dengan satu ketukan.</p>
            </div>
            <div className="rounded-[18px] rounded-tl-[6px] bg-surface p-4 text-[13.5px] leading-relaxed shadow-[var(--shadow-card)]">
              <p className="font-bold">Laporan Dapur Ahmad</p>
              <p className="text-ink-3">Kamis, 24 September</p>
              <p className="mt-2">
                Penjualan <b>EGP 2.310</b> dari 19 transaksi
              </p>
              <p>
                Laba bersih <b>EGP 910</b>
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-3">
                <ChatCircleText size={15} aria-hidden /> Dikirim lewat Possir
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

export function Testimonials() {
  const [first, ...rest] = TESTIMONIALS;
  return (
    <section id="testimoni" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 pt-24 md:px-8 md:pt-32">
      <h2 className="max-w-[20ch] text-[30px] font-bold leading-[1.1] tracking-[-0.03em] md:text-[40px]">Kata mereka yang sudah pakai.</h2>
      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <figure className="flex flex-col justify-between rounded-[var(--radius-card)] bg-brand p-7 text-on-brand md:p-9">
          <Quotes size={36} weight="fill" aria-hidden className="opacity-60" />
          <blockquote className="mt-6 text-[22px] font-semibold leading-snug tracking-[-0.015em] md:text-[26px]">
            {'“'}
            {first.quote}
            {'”'}
          </blockquote>
          <Person t={first} className="mt-8" inverted />
        </figure>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rest.map((t, i) => (
            <figure key={t.name} className={cn('card flex flex-col justify-between p-6', i === rest.length - 1 && rest.length % 2 === 1 && 'sm:col-span-2')}>
              <blockquote className="text-[15.5px] leading-relaxed text-ink">
                {'“'}
                {t.quote}
                {'”'}
              </blockquote>
              <Person t={t} className="mt-6" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Person({ t, className, inverted }: { t: (typeof TESTIMONIALS)[number]; className?: string; inverted?: boolean }) {
  return (
    <figcaption className={cn('flex items-center gap-3', className)}>
      <Avatar name={t.name} size="md" />
      <span className="min-w-0">
        <span className="block text-[14.5px] font-bold">{t.name}</span>
        <span className={cn('block text-[13px]', inverted ? 'opacity-80' : 'text-ink-3')}>
          {t.business}, {t.place}
        </span>
      </span>
    </figcaption>
  );
}

export function FinalCta({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-24 md:px-8 md:py-32">
      <div className="grid grid-cols-1 items-center gap-6 rounded-[32px] bg-surface px-6 py-10 shadow-[var(--shadow-card)] md:grid-cols-[minmax(0,1fr)_auto] md:px-12 md:py-14">
        <div>
          <h2 className="max-w-[22ch] text-[28px] font-bold leading-[1.1] tracking-[-0.03em] md:text-[36px]">Mulai catat jualan hari ini.</h2>
          <p className="mt-3 max-w-[48ch] text-[15.5px] text-ink-2">Gratis. Cukup email, lalu buat usaha pertamamu dalam dua menit.</p>
        </div>
        <div className="flex flex-wrap gap-3">{children}</div>
      </div>
    </section>
  );
}
