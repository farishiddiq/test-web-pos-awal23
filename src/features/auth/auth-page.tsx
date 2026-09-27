import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ArrowDown, ArrowRight, EnvelopeSimple, Eye, EyeSlash, PlayCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useSession } from '@/data/session';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/form';
import { normalizeUsername, toAuthEmail, usernameError } from '@/lib/username';
import { cn } from '@/lib/util';
import { AuthBrand } from './auth-brand';
import { BrandFooter, BusinessMarquee, EgyptDetails, FactsBand, FeatureTour, FinalCta, GrowthFeatures, Showcase, Testimonials } from './landing-sections';

type Mode = 'login' | 'register' | 'forgot';

export function AuthPage({ mode: initialMode }: { mode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);

  // Tombol Masuk/Daftar di bagian bawah halaman: ganti mode, gulir ke form, fokus ke isian pertama
  const openAuth = (next: 'login' | 'register') => {
    setMode(next);
    navigate(next === 'login' ? '/masuk' : '/daftar', { replace: true });
    const form = formRef.current;
    if (!form) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => form.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }), reduce ? 0 : 450);
  };

  return (
    <div className="landing min-h-dvh overflow-x-clip">
      {/* Layar masuk: form di kiri, panel merek dengan screenshot asli di kanan */}
      {/* Di laptop: tepat satu layar (100dvh), isi menyesuaikan tinggi layar */}
      <section className="relative p-2.5 md:p-4 lg:h-[100dvh] lg:min-h-[600px] lg:p-5">
        <div className="mx-auto grid min-h-[calc(100dvh-20px)] max-w-[1400px] grid-cols-1 gap-2.5 rounded-[32px] bg-surface p-2.5 shadow-[var(--shadow-float)] md:min-h-[calc(100dvh-32px)] md:p-3 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          {/* identitas POSSIR lebih dulu: di HP tampil paling atas */}
          <AuthBrand />

          <div className="flex min-w-0 flex-col px-4 pb-4 pt-2 md:px-8 lg:min-h-0 lg:overflow-y-auto lg:px-10 lg:pt-5">
            <div ref={formRef} id="akun" className="mx-auto flex w-full max-w-[400px] flex-1 scroll-mt-24 flex-col justify-center py-8 lg:py-5 lg:[@media(max-height:820px)]:py-2">
              <AuthForm mode={mode} onModeChange={setMode} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-[13.5px] text-ink-3 lg:[@media(max-height:820px)]:hidden">
              <a href="#lihat-fitur" className="hover:text-ink">Lihat fitur</a>
              <span>© 2026 Possir</span>
            </div>
          </div>
        </div>

        {/* Penanda bahwa halaman bisa digulir: pil di tengah bawah, menempel di tepi kartu */}
        <button
          type="button"
          onClick={() => {
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            document.getElementById('lihat-fitur')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
          }}
          className="scroll-cue pressable absolute bottom-9 left-1/2 z-10 hidden -translate-x-1/2 translate-y-1/2 items-center gap-2 rounded-full bg-ink py-2.5 pl-5 pr-2.5 text-[14px] font-semibold text-canvas shadow-[var(--shadow-float)] hover:bg-brand lg:inline-flex"
        >
          Gulir untuk lihat fitur
          <span className="grid size-8 place-items-center rounded-full bg-lime text-on-lime">
            <ArrowDown size={16} weight="bold" className="cue-arrow" aria-hidden />
          </span>
        </button>
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

const TITLES: Record<Mode, string> = {
  login: 'Masuk ke Possir',
  register: 'Daftar di Possir',
  forgot: 'Lupa kata sandi',
};

function AuthForm({ mode, onModeChange }: { mode: Mode; onModeChange: (mode: Mode) => void }) {
  const { supabaseReady, startDemo, signIn, signUp, requestPasswordReset } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const demoButton = (
    <button
      type="button"
      onClick={openDemo}
      disabled={demoBusy}
      className="pressable inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime px-6 text-[15px] font-bold text-on-lime ring-1 ring-inset ring-[color-mix(in_oklab,var(--on-lime)_14%,transparent)] hover:brightness-105 disabled:opacity-70"
    >
      <PlayCircle size={20} weight="fill" aria-hidden />
      {demoBusy ? 'Menyiapkan demo…' : 'Lihat demo tanpa daftar'}
    </button>
  );

  if (!supabaseReady) {
    return (
      <div className="text-center">
        <h1 className="text-[28px] font-bold tracking-[-0.03em] xl:text-[32px]">Coba Possir sekarang</h1>
        <p className="mx-auto mt-2 max-w-[36ch] text-[15px] text-ink-3">5 minggu data contoh toko barang Indonesia dan Asia. Berjalan di browser kamu, tanpa daftar.</p>
        <div className="mt-6">{demoButton}</div>
        <div className="mt-6 rounded-[16px] bg-surface-2 p-4 text-left text-[13px] leading-relaxed text-ink-2">
          <p className="font-semibold text-ink">Untuk akun sungguhan</p>
          <p className="mt-1">
            Hubungkan Supabase: isi <code className="rounded bg-surface-3 px-1 py-0.5 text-[12px]">VITE_SUPABASE_URL</code> dan{' '}
            <code className="rounded bg-surface-3 px-1 py-0.5 text-[12px]">VITE_SUPABASE_ANON_KEY</code>, lalu jalankan ulang aplikasi.
          </p>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-brand-ink">
          <EnvelopeSimple size={28} />
        </div>
        <h1 className="mt-4 text-[26px] font-bold tracking-[-0.02em]">Cek email kamu</h1>
        <p className="mx-auto mt-2 max-w-[34ch] text-[14.5px] text-ink-2">{`Kalau ${login.trim()} terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim.`}</p>
        <Button variant="secondary" className="mt-6" onClick={() => switchMode('login')}>
          Kembali ke halaman masuk
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="text-center">
        <h1 className="text-[28px] font-bold tracking-[-0.03em] xl:text-[32px]">{TITLES[mode]}</h1>
        <p className="mx-auto mt-2 max-w-[36ch] text-[15px] text-ink-3">
          {mode === 'forgot'
            ? 'Khusus akun lama yang daftar pakai email. Akun username: minta admin Possir mengatur ulang kata sandimu.'
            : 'Kasir, stok, dan piutang untuk usaha Masisir.'}
        </p>
      </div>

      {mode !== 'forgot' && (
        <>
          <div className="mt-6">{demoButton}</div>
          <div className="my-5 flex items-center gap-3 text-[13px] text-ink-3 [@media(max-height:820px)]:my-3.5">
            <span className="h-px flex-1 bg-line" />
            atau pakai username
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <div className={cn('grid gap-4 [@media(max-height:820px)]:gap-3', mode === 'forgot' && 'mt-8')}>
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
          <Field label="Username" htmlFor="auth-login" hint={mode === 'register' ? 'Huruf kecil, angka, titik, atau garis bawah.' : undefined}>
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
          <Field label="Kata sandi" htmlFor="auth-password">
            <div className="relative">
              <TextInput
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'register' ? 'Minimal 6 karakter' : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                {showPassword ? <EyeSlash size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
              </button>
            </div>
          </Field>
        )}
        {mode === 'login' && (
          <div className="-mt-1 text-right">
            <button type="button" onClick={() => switchMode('forgot')} className="text-[14px] font-semibold text-brand hover:underline">
              Lupa kata sandi?
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[14px] font-medium text-danger-ink">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" block loading={busy} loadingText="Sebentar…">
          {mode === 'login' ? 'Masuk' : mode === 'register' ? 'Daftar gratis' : 'Kirim tautan'}
        </Button>
      </div>

      <p className="mt-5 text-center text-[14.5px] text-ink-2">
        {mode === 'login' ? (
          <>
            Belum punya akun?{' '}
            <button type="button" onClick={() => switchMode('register')} className="font-bold text-ink hover:underline">
              Daftar gratis
            </button>
          </>
        ) : (
          <>
            {mode === 'register' ? 'Sudah punya akun?' : 'Ingat kata sandinya?'}{' '}
            <button type="button" onClick={() => switchMode('login')} className="font-bold text-ink hover:underline">
              Masuk
            </button>
          </>
        )}
      </p>
    </form>
  );
}
