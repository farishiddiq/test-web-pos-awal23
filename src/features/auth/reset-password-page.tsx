import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useSession } from '@/data/session';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/form';
import { BootScreen } from '@/app/guards';

export function ResetPasswordPage() {
  const { status, updatePassword } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'booting') return <BootScreen />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError('Kata sandi minimal 6 karakter.');
    if (password !== confirm) return setError('Kedua kata sandi belum sama.');
    setBusy(true);
    try {
      await updatePassword(password);
      toast.success('Kata sandi baru tersimpan');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kata sandi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <Logo className="mb-8" />
        <div className="card p-6 md:p-8">
          {status !== 'ready' ? (
            <>
              <h1 className="text-[22px] font-bold tracking-[-0.02em]">Tautan sudah tidak berlaku</h1>
              <p className="mt-2 text-[14px] text-ink-2">Minta tautan baru untuk mengatur ulang kata sandi.</p>
              <Link to="/lupa-sandi" className="mt-6 inline-block text-[14px] font-bold text-brand hover:underline">
                Kirim tautan baru
              </Link>
            </>
          ) : (
            <form onSubmit={submit} noValidate className="grid gap-4">
              <div>
                <h1 className="text-[22px] font-bold tracking-[-0.02em]">Buat kata sandi baru</h1>
                <p className="mt-1.5 text-[14px] text-ink-3">Setelah disimpan kamu langsung masuk.</p>
              </div>
              <Field label="Kata sandi baru" htmlFor="new-password" hint="Minimal 6 karakter.">
                <TextInput id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field label="Ulangi kata sandi" htmlFor="confirm-password">
                <TextInput id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
              {error && (
                <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[14px] font-medium text-danger-ink">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" block loading={busy}>
                Simpan kata sandi
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
