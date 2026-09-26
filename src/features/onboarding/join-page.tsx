import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/form';
import { api } from '@/data/api';
import { useBusinessState } from '@/data/business';
import { useSession } from '@/data/session';

export function JoinPage() {
  const { user } = useSession();
  const { selectBusiness, businesses } = useBusinessState();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length !== 8) return setError('Kode undangan terdiri dari 8 huruf/angka.');
    setBusy(true);
    try {
      const ctx = await api.acceptInvite(code, name.trim() || null);
      await queryClient.invalidateQueries({ queryKey: ['businesses'] });
      selectBusiness(ctx.business.id);
      toast.success(`Selamat datang di ${ctx.business.name}`);
      navigate('/kasir', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal bergabung.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <Logo className="mb-8" />
        <form onSubmit={submit} className="card grid gap-4 p-6 md:p-8" noValidate>
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.025em]">Gabung ke usaha</h1>
            <p className="mt-1.5 text-[14px] text-ink-3">Minta kode undangan ke pemilik usaha. Kode berlaku 7 hari dan sekali pakai.</p>
          </div>
          <Field label="Kode undangan" htmlFor="join-code">
            <TextInput
              id="join-code"
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              maxLength={8}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              className="text-center text-[22px] font-bold tracking-[0.3em] tabular"
              placeholder="A1B2C3D4"
            />
          </Field>
          <Field label="Nama kamu" htmlFor="join-name" hint="Tampil sebagai kasir di transaksi.">
            <TextInput id="join-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          {error && (
            <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[14px] font-medium text-danger-ink">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block loading={busy}>
            Gabung
          </Button>
          <Link to={businesses.length ? '/' : '/mulai'} className="text-center text-[14px] font-semibold text-ink-2 hover:text-ink">
            {businesses.length ? 'Kembali ke beranda' : 'Buat usaha sendiri'}
          </Link>
        </form>
      </div>
    </div>
  );
}
