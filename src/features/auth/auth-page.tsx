import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, EnvelopeSimple, MapPin } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useSession } from '@/data/session';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/form';
import { Segmented } from '@/components/ui/choice';
import { normalizeUsername, toAuthEmail, usernameError } from '@/lib/username';
import { BrandFooter, BusinessMarquee, EgyptDetails, FactsBand, FeatureTour, FinalCta, GrowthFeatures, Showcase, Testimonials } from './landing-sections';

type Mode = 'login' | 'register' | 'forgot';

export function AuthPage({ mode: initialMode }: { mode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);

  // Tombol Masuk/Daftar di mana pun: ganti mode kartu, gulir ke sana, fokus ke isian pertama
  const openAuth = (next: 'login' | 'register') => {
    setMode(next);
    navigate(next === 'login' ? '/masuk' : '/daftar', { replace: true });
    const card = cardRef.current;
    if (!card) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => card.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }), reduce ? 0 : 450);
  };

  return (
    <div className="landing min-h-dvh overflow-x-clip">
      <header className="material sticky top-0 z-40 border-b border-line/70">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-5 md:h-[72px] md:px-8">
          <Logo />
          <nav aria-label="Halaman" className="flex items-center gap-1 md:gap-2">
            <a href="#fitur" className="hidden rounded-full px-3 py-2 text-[14px] font-semibold text-ink-2 hover:text-ink md:inline">Fitur</a>
            <a href="#testimoni" className="hidden rounded-full px-3 py-2 text-[14px] font-semibold text-ink-2 hover:text-ink md:inline">Testimoni</a>
            <Button variant="ghost" size="sm" onClick={() => openAuth('login')}>Masuk</Button>
            <Button size="sm" onClick={() => openAuth('register')}>Daftar gratis</Button>
          </nav>
        </div>
      </header>

      <section className="px-2.5 pt-2.5 md:px-4 md:pt-4">
        <div className="relative isolate overflow-hidden rounded-[32px] bg-[var(--deep)] text-[var(--on-deep)] md:rounded-[40px]">
          <span aria-hidden className="brand-rings parallax-rings -right-40 -top-48 size-[620px] border-[88px] md:-right-24" />
          <span aria-hidden className="brand-rings parallax-rings -bottom-72 -left-40 size-[520px] border-[72px] max-md:hidden" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--deep-2)]" />

          <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-5 pb-40 pt-12 md:px-8 md:pb-52 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-14 lg:pt-20">
            <div className="min-w-0">
              <p style={{ '--i': 0 } as CSSProperties} className="hero-in inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-[var(--on-deep-2)]">
                <MapPin size={15} weight="fill" className="text-lime" aria-hidden /> Untuk mahasiswa Indonesia di Mesir
              </p>
              <h1 style={{ '--i': 1 } as CSSProperties} className="hero-in mt-5 max-w-[14ch] text-[42px] font-bold leading-[1.03] tracking-[-0.035em] sm:text-[54px] lg:text-[62px]">
                Kasir untuk usaha <span className="text-lime">Masisir</span>.
              </h1>
              <p style={{ '--i': 2 } as CSSProperties} className="hero-in mt-5 max-w-[42ch] text-[16px] leading-relaxed text-[var(--on-deep-2)] md:text-[17.5px]">
                Catat penjualan, stok, hutang customer, dan untung usahamu dari HP. Semua dalam EGP.
              </p>
              <div style={{ '--i': 3 } as CSSProperties} className="hero-in mt-8 flex flex-wrap gap-3 max-lg:hidden">
                <button type="button" onClick={() => openAuth('register')} className="pressable inline-flex h-14 items-center gap-2 rounded-full bg-lime px-7 text-[16px] font-bold text-on-lime hover:brightness-105">
                  Daftar gratis <ArrowRight size={18} weight="bold" aria-hidden />
                </button>
                <a href="#fitur" className="pressable inline-flex h-14 items-center rounded-full border border-white/25 px-7 text-[16px] font-bold hover:bg-white/10">
                  Lihat fitur
                </a>
              </div>
            </div>
            <div ref={cardRef} className="text-ink">
              <AuthCard mode={mode} onModeChange={setMode} />
            </div>
          </div>
        </div>
      </section>

      <Showcase />
      <BusinessMarquee />
      <FeatureTour />
      <FactsBand />
      <EgyptDetails />
      <GrowthFeatures />
      <Testimonials />
      <FinalCta>
        <Button size="lg" onClick={() => openAuth('register')} iconRight={<ArrowRight size={18} weight="bold" />}>Daftar gratis</Button>
        <Button size="lg" variant="secondary" onClick={() => openAuth('login')}>Masuk</Button>
      </FinalCta>
      <BrandFooter onAuth={openAuth} />
    </div>
  );
}

function AuthCard({ mode, onModeChange }: { mode: Mode; onModeChange: (mode: Mode) => void }) {
  const { supabaseReady, startDemo, signIn, signUp, requestPasswordReset } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const switchMode = (next: Mode) => {
    onModeChange(next);
    setError(null);
    setSent(false);
    navigate(next === 'login' ? '/masuk' : next === 'register' ? '/daftar' : '/lupa-sandi', { replace: true });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const id = normalizeUsername(login);
    if (mode === 'forgot') {
      if (!id.includes('@')) return setError('Akun username tidak punya email. Minta admin Possir mengatur ulang kata sandimu.');
    } else if (!id) {
      return setError('Isi username dulu.');
    } else if (mode === 'register' || !id.includes('@')) {
      // akun lama boleh masuk pakai email; akun baru wajib username
      const invalid = usernameError(id);
      if (invalid) return setError(invalid);
    }
    if (mode !== 'forgot' && password.length < 6) return setError('Kata sandi minimal 6 karakter.');
    if (mode === 'register' && !name.trim()) return setError('Isi nama kamu dulu.');
    setBusy(true);
    try {
      if (mode === 'login') await signIn(toAuthEmail(id), password);
      else if (mode === 'register') {
        const { needsConfirmation } = await signUp(toAuthEmail(id), password, name.trim());
        if (needsConfirmation) {
          setError('Akun dibuat, tapi Supabase masih meminta konfirmasi email. Admin perlu mematikan "Confirm email" di Supabase, lalu kamu bisa masuk.');
        }
      } else {
        await requestPasswordReset(id);
        setSent(true);
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
    <div id="akun" className="card mx-auto w-full max-w-[440px] scroll-mt-24 p-6 md:p-8">
      {!supabaseReady ? (
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em]">Coba Possir sekarang</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Demo berisi 5 minggu data contoh toko barang Indonesia dan Asia. Semua berjalan di browser kamu, tanpa daftar.
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
            {`Kalau ${login.trim()} terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim.`}
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
              <p className="mt-1.5 text-[14px] text-ink-3">Khusus akun lama yang daftar pakai email. Akun username: minta admin Possir mengatur ulang kata sandimu.</p>
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
            {mode === 'forgot' ? (
              <Field label="Email akun" htmlFor="auth-login">
                <TextInput id="auth-login" type="email" inputMode="email" autoComplete="email" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="nama@email.com" />
              </Field>
            ) : (
              <Field label="Username" htmlFor="auth-login" hint={mode === 'register' ? 'Huruf kecil, angka, titik, atau garis bawah. Minimal 3 karakter.' : undefined}>
                <TextInput
                  id="auth-login"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={login}
                  onChange={(e) => setLogin(mode === 'register' ? e.target.value.toLowerCase().replace(/\s/g, '') : e.target.value)}
                  placeholder="misal: ahmad.fauzi"
                />
              </Field>
            )}
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
              <button
                type="button"
                onClick={openDemo}
                disabled={demoBusy}
                className="pressable inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-lime px-6 text-[16px] font-bold text-on-lime ring-1 ring-inset ring-[color-mix(in_oklab,var(--on-lime)_14%,transparent)] hover:brightness-105 disabled:opacity-70"
              >
                {demoBusy ? 'Menyiapkan demo…' : 'Lihat demo tanpa daftar'}
                {!demoBusy && <ArrowRight size={18} weight="bold" aria-hidden />}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
