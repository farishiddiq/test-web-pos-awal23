import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
  Cookie,
  CookingPot,
  Coffee,
  Snowflake,
  ShoppingBag,
  BowlFood,
  Cake,
  Storefront,
} from '@phosphor-icons/react';
import { Avatar } from '@/components/ui/display';
import { Logo } from '@/components/layout/logo';
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
    <section aria-label="Tampilan Possir" className="relative z-10 mx-auto -mt-32 max-w-[1200px] px-5 md:-mt-44 md:px-8">
      <div className="grid grid-cols-1 items-end gap-6 md:grid-cols-[minmax(0,1fr)_220px] lg:grid-cols-[minmax(0,1fr)_250px] lg:gap-8">
        <DesktopShot
          src="/screens/dashboard-desktop.webp"
          alt="Dashboard Possir: penjualan hari ini, grafik 7 hari, laba kotor, uang masuk, pengeluaran, dan arus kas"
          eager
          className="parallax-far"
        />
        <PhoneShot
          src="/screens/dashboard-mobile.webp"
          alt="Dashboard Possir di HP"
          className="parallax-near mx-auto w-[220px] max-md:hidden lg:w-[250px] md:-mb-10"
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
  // Berputar sendiri sampai pengguna memilih tab. Tertahan saat disentuh kursor, difokus,
  // atau di luar layar. Tidak berputar untuk pengguna "kurangi gerak".
  const [auto, setAuto] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hold, setHold] = useState(false);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !auto) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [auto]);

  const next = () => {
    const i = TABS.findIndex((t) => t.key === active);
    setActive(TABS[(i + 1) % TABS.length].key);
  };

  return (
    <section
      ref={sectionRef}
      id="fitur"
      className="mx-auto max-w-[1200px] scroll-mt-24 px-5 pt-24 md:px-8 md:pt-32"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setHold(false)}
    >
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
                onClick={() => {
                  setAuto(false);
                  setActive(t.key);
                }}
                className={cn(
                  'pressable relative grid grid-cols-[40px_minmax(0,1fr)] gap-x-3.5 rounded-[22px] p-4 text-left transition-colors duration-200',
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
                {auto && on && (
                  <span aria-hidden className="absolute inset-x-5 bottom-2 h-[3px] overflow-hidden rounded-full bg-surface-3">
                    <span
                      key={active}
                      className="tour-progress block h-full rounded-full bg-brand"
                      data-paused={hold || !inView}
                      onAnimationEnd={next}
                    />
                  </span>
                )}
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
      <h2 className="max-w-[20ch] text-[30px] font-bold leading-[1.1] tracking-[-0.03em] md:text-[40px]">Hal kecil yang sering bikin rugi, sudah diurus.</h2>
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
        <figure className="reveal flex flex-col justify-between rounded-[var(--radius-card)] bg-brand p-7 text-on-brand md:p-9">
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
            <figure key={t.name} style={{ '--i': i + 1 } as CSSProperties} className={cn('reveal card flex flex-col justify-between p-6', i === rest.length - 1 && rest.length % 2 === 1 && 'sm:col-span-2')}>
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
      <div className="relative isolate grid grid-cols-1 items-center gap-6 overflow-hidden rounded-[32px] bg-lime px-6 py-10 text-on-lime md:grid-cols-[minmax(0,1fr)_auto] md:px-12 md:py-14">
        <span aria-hidden className="brand-rings -right-24 -top-32 -z-10 size-[360px] border-[56px] !border-[color-mix(in_oklab,var(--on-lime)_7%,transparent)]" />
        <div>
          <h2 className="max-w-[22ch] text-[28px] font-bold leading-[1.1] tracking-[-0.03em] md:text-[36px]">Mulai catat jualan hari ini.</h2>
          <p className="mt-3 max-w-[48ch] text-[15.5px] opacity-80">Gratis. Cukup email, lalu buat usaha pertamamu dalam dua menit.</p>
        </div>
        <div className="flex flex-wrap gap-3">{children}</div>
      </div>
    </section>
  );
}

const BUSINESS_TYPES = [
  [CookingPot, 'Katering rumahan'],
  [Snowflake, 'Frozen food'],
  [ShoppingBag, 'Jastip'],
  [BowlFood, 'Warung bakso dan soto'],
  [Cake, 'Kue dan roti'],
  [Coffee, 'Minuman dan kopi'],
  [Cookie, 'Camilan kemasan'],
  [Storefront, 'Toko kelontong'],
] as const;

/** Jenis usaha yang cocok. Satu-satunya marquee di halaman. */
export function BusinessMarquee() {
  const row = (dup: boolean) => (
    <ul aria-hidden={dup || undefined} className={cn('flex shrink-0 items-center gap-3 pr-3', dup && 'marquee-dup')}>
      {BUSINESS_TYPES.map(([I, label]) => (
        <li key={label} className="inline-flex h-12 items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-surface px-5 text-[15px] font-semibold text-ink">
          <I size={19} className="text-brand" aria-hidden /> {label}
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Cocok untuk" className="mx-auto max-w-[1200px] px-5 pt-20 md:px-8 md:pt-28">
      <p className="text-center text-[15px] font-semibold text-ink-3">Cocok untuk usaha seperti</p>
      <div className="marquee mt-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
        <div className="marquee-track">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </section>
  );
}

const FACTS = [
  ['EGP', 'Semua harga, laporan, dan struk dalam pound Mesir'],
  ['7', 'Cara bayar Mesir, dari cash sampai Vodafone Cash'],
  ['Kairo', 'Tutup buku harian ikut jam Mesir, termasuk musim panas'],
  ['Gratis', 'Daftar tanpa kartu kredit, jalan di HP tanpa mesin kasir'],
] as const;

/** Fakta produk dalam pita merek, tanpa kartu */
export function FactsBand() {
  return (
    <section className="px-2.5 pt-24 md:px-4 md:pt-32">
      <div className="relative isolate overflow-clip rounded-[32px] bg-[var(--deep)] px-5 py-14 text-[var(--on-deep)] md:rounded-[40px] md:px-8 md:py-20">
        <span aria-hidden className="brand-rings -bottom-56 -right-32 -z-10 size-[480px] border-[72px]" />
        <div className="mx-auto max-w-[1200px]">
          <h2 className="max-w-[22ch] text-[30px] font-bold leading-[1.1] tracking-[-0.03em] md:text-[40px]">
            Dibuat untuk cara jualan <span className="text-lime">Masisir</span>.
          </h2>
          <dl className="mt-12 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {FACTS.map(([big, text], i) => (
              <div key={big} style={{ '--i': i } as CSSProperties} className="reveal border-t border-white/15 pt-5">
                <dt className="text-[44px] font-bold leading-none tracking-[-0.04em] text-lime md:text-[52px]">{big}</dt>
                <dd className="mt-3 max-w-[26ch] text-[15px] leading-relaxed text-[var(--on-deep-2)]">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/** Footer merek: wordmark besar dan tautan */
export function BrandFooter({ onAuth }: { onAuth: (mode: 'login' | 'register') => void }) {
  const link = 'text-[15px] font-semibold text-[var(--on-deep-2)] hover:text-[var(--on-deep)]';
  return (
    <footer className="px-2.5 pb-2.5 md:px-4 md:pb-4">
      <div className="relative isolate overflow-hidden rounded-[32px] bg-[var(--deep-2)] px-5 pb-8 pt-14 text-[var(--on-deep)] md:rounded-[40px] md:px-8">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
          <div>
            <span className="[&_span.text-ink]:text-[var(--on-deep)]">
              <Logo size={36} />
            </span>
            <p className="mt-4 max-w-[36ch] text-[15px] leading-relaxed text-[var(--on-deep-2)]">
              Kasir, stok, piutang, dan laporan untuk usaha mahasiswa Indonesia di Mesir.
            </p>
          </div>
          <nav aria-label="Produk" className="grid content-start gap-3">
            <p className="text-[13px] font-bold text-[var(--on-deep)]">Produk</p>
            <a href="#fitur" className={link}>Fitur</a>
            <a href="#testimoni" className={link}>Testimoni</a>
          </nav>
          <nav aria-label="Akun" className="grid content-start gap-3">
            <p className="text-[13px] font-bold text-[var(--on-deep)]">Akun</p>
            <button type="button" onClick={() => onAuth('login')} className={cn(link, 'text-left')}>Masuk</button>
            <button type="button" onClick={() => onAuth('register')} className={cn(link, 'text-left')}>Daftar gratis</button>
          </nav>
        </div>
        <p aria-hidden className="mx-auto mt-14 max-w-[1200px] select-none text-[clamp(96px,22vw,300px)] font-extrabold leading-[0.95] tracking-[-0.06em] text-lime/90">
          possir
        </p>
        <p className="mx-auto mt-8 max-w-[1200px] text-[13px] text-[var(--on-deep-2)]">© 2026 Possir. Untuk warung rumahan, katering, frozen food, jastip, dan usaha Masisir lainnya.</p>
      </div>
    </footer>
  );
}
