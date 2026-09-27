import { useEffect, useState } from 'react';
import { cn } from '@/lib/util';
import { ClipShot } from './landing-sections';

// Panel merek di samping form masuk: screenshot asli (npm run screenshots) yang berganti,
// dengan satu kartu potongan layar lain yang "melayang" seperti di contoh desain.
const SLIDES = [
  {
    title: 'Kasir cepat, stok jalan sendiri',
    body: 'Ketuk produk, pilih cara bayar Mesir, selesai. Setiap penjualan langsung mengurangi stok.',
    phone: { src: '/screens/kasir-mobile.webp', alt: 'Kasir Possir di HP' },
    card: { src: '/screens/stok-opname.webp', alt: 'Riwayat stok dan stock opname', width: 920, height: 1752, className: 'w-[170px]', maxH: '210px' },
  },
  {
    title: 'Hutang customer tercatat rapi',
    body: 'Bayar sebagian, janji bayar, dan pengingat WhatsApp. Kasir diundang dengan kode, semua tercatat.',
    phone: { src: '/screens/piutang-mobile.webp', alt: 'Halaman piutang Possir di HP' },
    card: { src: '/screens/anggota.webp', alt: 'Daftar anggota: pemilik dan kasir', width: 2312, height: 618, className: 'w-[270px]' },
  },
  {
    title: 'Tahu untung setiap hari',
    body: 'Penjualan, laba kotor, uang masuk, dan pengeluaran hari ini langsung terlihat dari HP.',
    phone: { src: '/screens/dashboard-mobile.webp', alt: 'Dashboard Possir di HP' },
    card: { src: '/screens/jam-ramai.webp', alt: 'Grafik jam ramai penjualan', width: 1362, height: 614, className: 'w-[270px]' },
  },
] as const;

const INTERVAL = 6000;

export function AuthShowcase({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [hold, setHold] = useState(false);
  const [auto] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (!auto || hold) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL);
    return () => window.clearTimeout(id);
  }, [auto, hold, index]);

  const slide = SLIDES[index];

  return (
    <section
      aria-label="Fitur Possir"
      aria-roledescription="carousel"
      className={cn('relative isolate flex flex-col overflow-hidden rounded-[26px] bg-[var(--deep)] px-6 pb-6 pt-8 text-[var(--on-deep)] md:px-10 lg:pt-10', className)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setHold(false)}
    >
      <span aria-hidden className="brand-rings -right-32 -top-40 -z-10 size-[460px] border-[70px]" />
      <span aria-hidden className="brand-rings -bottom-48 -left-40 -z-10 size-[380px] border-[56px]" />

      {/* komposisi screenshot */}
      {/* Di laptop, tinggi HP mengikuti sisa tinggi panel supaya satu layar pas tanpa terpotong */}
      <div key={index} className="tour-panel relative flex w-full flex-1 items-center justify-center py-2 lg:min-h-0">
        <div className="relative w-[min(230px,58%)] lg:aspect-[390/844] lg:h-full lg:max-h-[540px] lg:w-auto">
          <div className="rounded-[40px] bg-ink p-[9px] shadow-[var(--shadow-float)] lg:h-full dark:bg-surface-3">
            <img
              src={slide.phone.src}
              alt={slide.phone.alt}
              width={390}
              height={844}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="block h-auto w-full rounded-[32px] lg:h-full lg:object-cover lg:object-top"
            />
          </div>
          <ClipShot
            src={slide.card.src}
            alt={slide.card.alt}
            width={slide.card.width}
            height={slide.card.height}
            maxH={'maxH' in slide.card ? slide.card.maxH : undefined}
            className={cn('absolute bottom-[8%] right-[58%] rotate-[-2deg] shadow-[var(--shadow-float)] max-sm:hidden', slide.card.className)}
          />
        </div>
      </div>

      <div aria-live="polite" className="mx-auto mt-5 max-w-[40ch] shrink-0 text-center">
        <h2 className="text-[24px] font-bold leading-tight tracking-[-0.025em] xl:text-[28px]">{slide.title}</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--on-deep-2)]">{slide.body}</p>
      </div>

      <div role="tablist" aria-label="Pilih fitur" className="mt-4 flex shrink-0 justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={s.title}
            onClick={() => setIndex(i)}
            className="grid h-6 place-items-center px-0.5"
          >
            <span className={cn('block h-1.5 rounded-full transition-[width,background-color] duration-200', i === index ? 'w-6 bg-lime' : 'w-1.5 bg-white/35')} />
          </button>
        ))}
      </div>
    </section>
  );
}
