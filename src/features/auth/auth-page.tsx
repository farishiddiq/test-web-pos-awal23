import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, EnvelopeSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useSession } from '@/data/session';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/form';
import { Segmented } from '@/components/ui/choice';
import { EgyptDetails, FeatureTour, FinalCta, Showcase, Testimonials } from './landing-sections';

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
    <div className="min-h-dvh overflow-x-clip">
      <header className="material sticky top-0 z-40 border-b border-line/70">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-5 md:h-[72px] md:px-8">
          <Logo />
          <nav aria-label="Halaman" className="flex items-center gap-1 md:gap-2">
            <a href="#fitur" className="hidden rounded-full px-3 py-2 text-[14px] font-semibold text-ink-2 hover:text-ink md:inline">Fitur</a>
            <a href="#testimoni" className="hidden rounded-full px-3 py-2 text-[14px] font-semibold text-ink-2 hover:text-ink md:inline">Testimoni</a>
            <Button variant="ghost" size="sm" onClick={() => openAuth('login')}>Masuk</Button>
            <Button size="sm" onClick={() => openAuth('register')}>Daftar gratis</Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-5 pb-14 pt-10 md:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-14 lg:pb-20 lg:pt-16">
        <div className="min-w-0">
          <h1 className="max-w-[14ch] text-[40px] font-bold leading-[1.04] tracking-[-0.035em] sm:text-[50px] lg:text-[58px]">
            Kasir untuk usaha Masisir.
          </h1>
          <p className="mt-5 max-w-[44ch] text-[16px] leading-relaxed text-ink-2 md:text-[17px]">
            Catat penjualan, stok, hutang teman, dan untung usaha mahasiswa Indonesia di Mesir dari HP. Semua pakai EGP.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 max-lg:hidden">
            <Button size="lg" onClick={() => openAuth('register')} iconRight={<ArrowRight size={18} weight="bold" />}>Daftar gratis</Button>
            <Button size="lg" variant="secondary" onClick={() => document.getElementById('fitur')?.scrollIntoView({ behavior: 'smooth' })}>Lihat fitur</Button>
          </div>
        </div>
        <div ref={cardRef}>
          <AuthCard mode={mode} onModeChange={setMode} />
        </div>
      </section>

      <Showcase />
      <FeatureTour />
      <EgyptDetails />
      <Testimonials />
      <FinalCta>
        <Button size="lg" onClick={() => openAuth('register')} iconRight={<ArrowRight size={18} weight="bold" />}>Daftar gratis</Button>
        <Button size="lg" variant="secondary" onClick={() => openAuth('login')}>Masuk</Button>
      </FinalCta>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-8 text-[13px] text-ink-3 md:px-8">
          <Logo size={24} />
          <p>Untuk warung rumahan, katering, frozen food, jastip, dan usaha Masisir lainnya.</p>
        </div>
      </footer>
    </div>
  );
}

function AuthCard({ mode, onModeChange }: { mode: Mode; onModeChange: (mode: Mode) => void }) {
  const { supabaseReady, startDemo, signIn, signUp, requestPasswordReset } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | 'confirm' | 'reset'>(null);

  const switchMode = (next: Mode) => {
    onModeChange(next);
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
    <div id="akun" className="card mx-auto w-full max-w-[440px] scroll-mt-24 p-6 md:p-8">
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
