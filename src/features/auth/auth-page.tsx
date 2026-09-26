import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight,
  Bank,
  ChatCircleText,
  DeviceMobile,
  EnvelopeSimple,
  HandCoins,
  Money as MoneyIcon,
  WhatsappLogo,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useSession } from '@/data/session';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/form';
import { Segmented } from '@/components/ui/choice';
import { Avatar, Badge, Money, ProductThumb } from '@/components/ui/display';

type Mode = 'login' | 'register' | 'forgot';

export function AuthPage({ mode: initialMode }: { mode: Mode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-5 md:px-8">
        <Logo />
        <a href="#fitur" className="text-[14px] font-semibold text-ink-2 hover:text-ink">
          Fitur
        </a>
      </header>

      <section className="mx-auto grid max-w-[1200px] gap-10 px-5 pb-16 pt-6 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-10">
        <div className="min-w-0">
          <h1 className="max-w-[14ch] text-[40px] font-bold leading-[1.04] tracking-[-0.035em] sm:text-[50px] lg:text-[58px]">
            Kasir untuk usaha Masisir.
          </h1>
          <p className="mt-5 max-w-[44ch] text-[16px] leading-relaxed text-ink-2 md:text-[17px]">
            Catat penjualan, stok, hutang teman, dan untung usaha mahasiswa Indonesia di Mesir dari HP. Semua pakai EGP.
          </p>
          <HeroPreview className="mt-10 hidden lg:block" />
        </div>
        <AuthCard initialMode={initialMode} />
        <HeroPreview className="lg:hidden" />
      </section>

      <FeatureBento />

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-8 text-[13px] text-ink-3 md:px-8">
          <Logo size={24} />
          <p>Dibuat untuk warung rumahan, katering, frozen food, jastip, dan usaha Masisir lainnya.</p>
        </div>
      </footer>
    </div>
  );
}

function AuthCard({ initialMode }: { initialMode: Mode }) {
  const { supabaseReady, startDemo, signIn, signUp, requestPasswordReset } = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | 'confirm' | 'reset'>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setSent(null);
    navigate(next === 'login' ? '/masuk' : next === 'register' ? '/daftar' : '/lupa-sandi', { replace: true });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes('@')) return setError('Masukkan email yang valid.');
    if (mode !== 'forgot' && password.length < 6) return setError('Kata sandi minimal 6 karakter.');
    if (mode === 'register' && !name.trim()) return setError('Isi nama kamu dulu.');
    setBusy(true);
    try {
      if (mode === 'login') await signIn(email.trim(), password);
      else if (mode === 'register') {
        const { needsConfirmation } = await signUp(email.trim(), password, name.trim());
        if (needsConfirmation) setSent('confirm');
      } else {
        await requestPasswordReset(email.trim());
        setSent('reset');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  const openDemo = async () => {
    setDemoBusy(true);
    try {
      await startDemo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Demo gagal dibuka.');
      setDemoBusy(false);
    }
  };

  return (
    <div className="card mx-auto w-full max-w-[440px] p-6 md:p-8">
      {!supabaseReady ? (
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em]">Coba Possir sekarang</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Demo berisi 5 minggu data usaha makanan contoh. Semua berjalan di browser kamu, tanpa daftar.
          </p>
          <Button size="lg" block className="mt-6" onClick={openDemo} loading={demoBusy} loadingText="Menyiapkan demo…" iconRight={<ArrowRight size={18} weight="bold" />}>
            Lihat demo
          </Button>
          <div className="mt-6 rounded-[16px] bg-surface-2 p-4 text-[13px] leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">Untuk akun sungguhan</p>
            <p className="mt-1">
              Hubungkan Supabase: isi <code className="rounded bg-surface-3 px-1 py-0.5 text-[12px]">VITE_SUPABASE_URL</code> dan{' '}
              <code className="rounded bg-surface-3 px-1 py-0.5 text-[12px]">VITE_SUPABASE_ANON_KEY</code> di file <code className="text-[12px]">.env</code>, lalu jalankan ulang aplikasi.
            </p>
          </div>
        </div>
      ) : sent ? (
        <div className="py-4 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-brand-ink">
            <EnvelopeSimple size={28} />
          </div>
          <h2 className="mt-4 text-[20px] font-bold">Cek email kamu</h2>
          <p className="mx-auto mt-2 max-w-[34ch] text-[14px] text-ink-2">
            {sent === 'confirm'
              ? `Kami mengirim tautan konfirmasi ke ${email}. Klik tautannya, lalu masuk.`
              : `Kalau ${email} terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim.`}
          </p>
          <Button variant="secondary" className="mt-6" onClick={() => switchMode('login')}>
            Kembali ke halaman masuk
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          {mode === 'forgot' ? (
            <div>
              <h2 className="text-[22px] font-bold tracking-[-0.02em]">Lupa kata sandi</h2>
              <p className="mt-1.5 text-[14px] text-ink-3">Kami kirim tautan untuk membuat kata sandi baru.</p>
            </div>
          ) : (
            <Segmented
              label="Pilih masuk atau daftar"
              className="w-full"
              value={mode}
              onChange={(m) => switchMode(m)}
              options={[
                { value: 'login', label: 'Masuk' },
                { value: 'register', label: 'Daftar' },
              ]}
            />
          )}

          <div className="mt-6 grid gap-4">
            {mode === 'register' && (
              <Field label="Nama kamu" htmlFor="auth-name">
                <TextInput id="auth-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Ahmad Fauzi" />
              </Field>
            )}
            <Field label="Email" htmlFor="auth-email">
              <TextInput
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
              />
            </Field>
            {mode !== 'forgot' && (
              <Field
                label="Kata sandi"
                htmlFor="auth-password"
                aside={
                  mode === 'login' ? (
                    <button type="button" onClick={() => switchMode('forgot')} className="text-[13px] font-semibold text-brand hover:underline">
                      Lupa?
                    </button>
                  ) : undefined
                }
                hint={mode === 'register' ? 'Minimal 6 karakter.' : undefined}
              >
                <TextInput
                  id="auth-password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
            {error && (
              <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[14px] font-medium text-danger-ink">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" block loading={busy} loadingText="Sebentar…">
              {mode === 'login' ? 'Masuk' : mode === 'register' ? 'Daftar gratis' : 'Kirim tautan'}
            </Button>
            {mode === 'forgot' && (
              <Button variant="ghost" onClick={() => switchMode('login')}>
                Kembali
              </Button>
            )}
          </div>

          {mode !== 'forgot' && (
            <>
              <div className="my-6 flex items-center gap-3 text-[12px] font-semibold text-ink-3">
                <span className="h-px flex-1 bg-line" />
                atau
                <span className="h-px flex-1 bg-line" />
              </div>
              <Button variant="secondary" size="lg" block onClick={openDemo} loading={demoBusy} loadingText="Menyiapkan demo…">
                Lihat demo tanpa daftar
              </Button>
            </>
          )}
        </form>
      )}
    </div>
  );
}

/** Pratinjau memakai komponen asli aplikasi, bukan screenshot palsu */
function HeroPreview({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <div className="mx-auto grid max-w-[560px] items-start gap-4 sm:grid-cols-[1.45fr_1fr] lg:mx-0">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-ink-3">Transaksi #1029 · 19:42</p>
              <p className="mt-0.5 text-[16px] font-bold">Dapur Ahmad</p>
            </div>
            <Badge tone="brand">Lunas</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {[
              ['Nasi Ayam Geprek', 2, 85, 'peach'],
              ['Mie Ayam Bakso', 1, 75, 'sand'],
              ['Es Teh Manis', 3, 15, 'sky'],
            ].map(([n, q, p, c]) => (
              <div key={n as string} className="flex items-center gap-3">
                <ProductThumb name={n as string} color={c as string} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{n}</p>
                  <p className="text-[12.5px] text-ink-3">
                    {q} × <Money value={p as number} />
                  </p>
                </div>
                <Money value={(q as number) * (p as number)} className="text-[14px] font-semibold" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
              <DeviceMobile size={16} /> Vodafone Cash
            </span>
            <Money value={290} className="text-[20px] font-bold tracking-tight" />
          </div>
        </div>
        <div className="hidden gap-4 sm:mt-20 sm:grid">
          <div className="rounded-[22px] p-4" style={{ background: 'var(--tint-peach-bg)' }}>
            <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--tint-peach-fg)' }}>
              <HandCoins size={16} /> Piutang
            </div>
            <Money value={450} className="mt-2 block text-[24px] font-bold tracking-tight" />
            <p className="text-[12.5px] text-ink-2">3 teman belum bayar</p>
          </div>
          <div className="card p-4">
            <p className="text-[13px] font-semibold text-ink-3">Laba bersih hari ini</p>
            <Money value={910} className="mt-1 block text-[24px] font-bold tracking-tight" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureBento() {
  return (
    <section id="fitur" className="mx-auto max-w-[1200px] scroll-mt-6 px-5 pb-20 md:px-8">
      <h2 className="max-w-[20ch] text-[28px] font-bold tracking-[-0.03em] md:text-[36px]">Dibuat untuk cara jualan Masisir.</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-6">
        <article className="card p-6 md:col-span-4">
          <h3 className="text-[18px] font-bold">Hutang teman tercatat, bukan diingat</h3>
          <p className="mt-1.5 max-w-[48ch] text-[14px] text-ink-2">
            Transaksi "bayar nanti" langsung masuk buku piutang. Bayar sebagian juga bisa, sisanya terhitung otomatis.
          </p>
          <div className="mt-5 divide-y divide-line rounded-[18px] border border-line">
            {[
              ['Hasan Basri', 955, 'sejak 6 hari'],
              ['Nabila Putri', 445, 'sejak 3 hari'],
              ['Abdullah Syakir', 195, 'kemarin'],
            ].map(([n, amount, since]) => (
              <div key={n as string} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={n as string} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{n}</p>
                  <p className="text-[12.5px] text-ink-3">{since}</p>
                </div>
                <Money value={amount as number} className="text-[14px] font-bold" />
                <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand-ink">
                  <WhatsappLogo size={17} weight="fill" />
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] p-6 md:col-span-2" style={{ background: 'var(--tint-lime-bg)' }}>
          <h3 className="text-[18px] font-bold">Pembayaran Mesir</h3>
          <p className="mt-1.5 text-[14px] text-ink-2">Cash, InstaPay, dan dompet digital. Aktifkan yang kamu pakai saja.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              [MoneyIcon, 'Cash'],
              [Bank, 'InstaPay'],
              [DeviceMobile, 'Vodafone Cash'],
              [DeviceMobile, 'Orange Cash'],
              [DeviceMobile, 'Etisalat Cash'],
              [HandCoins, 'Hutang'],
            ].map(([Icon, label]) => {
              const I = Icon as typeof MoneyIcon;
              return (
                <span key={label as string} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-semibold text-ink">
                  <I size={16} /> {label as string}
                </span>
              );
            })}
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] p-6 md:col-span-3" style={{ background: 'var(--tint-mint-bg)' }}>
          <h3 className="text-[18px] font-bold">Laporan langsung ke WhatsApp</h3>
          <p className="mt-1.5 text-[14px] text-ink-2">Satu ketukan: ringkasan harian atau bulanan siap dikirim ke grup atau partner usaha.</p>
          <div className="mt-5 max-w-[340px] rounded-[18px] rounded-tl-[6px] bg-surface p-4 text-[13.5px] leading-relaxed shadow-[var(--shadow-card)]">
            <p className="font-bold">Laporan Dapur Ahmad</p>
            <p className="text-ink-3">Kamis, 24 September</p>
            <p className="mt-2">
              Penjualan <b>EGP 2.310</b> dari 19 transaksi
            </p>
            <p>
              Laba bersih <b>EGP 910</b>
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-3">
              <ChatCircleText size={15} /> Dikirim lewat Possir
            </p>
          </div>
        </article>

        <article className="rounded-[var(--radius-card)] bg-ink p-6 text-canvas md:col-span-3 dark:bg-surface-3 dark:text-ink">
          <h3 className="text-[18px] font-bold">Dari HP, tanpa mesin kasir</h3>
          <p className="mt-1.5 max-w-[42ch] text-[14px] opacity-80">
            Pasang di layar utama seperti aplikasi. Setiap transaksi langsung mengurangi stok dan masuk ke laporan.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              ['Jual', 'catat cepat'],
              ['Stok', 'berkurang otomatis'],
              ['Laba', 'terhitung sendiri'],
            ].map(([a, b]) => (
              <div key={a} className="rounded-[16px] bg-canvas/10 p-3 dark:bg-surface/60">
                <p className="text-[16px] font-bold">{a}</p>
                <p className="text-[12.5px] opacity-80">{b}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
