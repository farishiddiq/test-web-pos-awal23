import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BowlFood,
  Check,
  CookingPot,
  DeviceMobile,
  Package,
  Plus,
  Snowflake,
  Storefront,
  TShirt,
  Trash,
  WashingMachine,
  type Icon,
} from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { Chip, OptionCard } from '@/components/ui/choice';
import { Field, MoneyInput, TextInput } from '@/components/ui/form';
import { api } from '@/data/api';
import { useBusinessState } from '@/data/business';
import { useSession } from '@/data/session';
import type { BusinessType } from '@/data/types';
import { formatMoney, parseAmount } from '@/lib/format';
import { cn, uuid } from '@/lib/util';

const TYPES: Array<{ value: BusinessType; label: string; hint: string; icon: Icon }> = [
  { value: 'makanan', label: 'Makanan & minuman', hint: 'Nasi, bakso, es teh', icon: BowlFood },
  { value: 'katering', label: 'Katering', hint: 'Paket harian, langganan', icon: CookingPot },
  { value: 'frozen', label: 'Frozen food', hint: 'Bakso, dimsum, nugget', icon: Snowflake },
  { value: 'toko', label: 'Toko & warung', hint: 'Sembako, snack', icon: Storefront },
  { value: 'jasa', label: 'Jasa & laundry', hint: 'Laundry, desain, servis', icon: WashingMachine },
  { value: 'jastip', label: 'Jastip', hint: 'Titip barang Indonesia', icon: Package },
  { value: 'pulsa', label: 'Pulsa & data', hint: 'Vodafone, Orange, e&', icon: DeviceMobile },
  { value: 'lainnya', label: 'Lainnya', hint: 'Reseller, pakaian, kitab', icon: TShirt },
];

const SUGGESTIONS: Record<BusinessType, Array<[string, number]>> = {
  makanan: [['Nasi Ayam Geprek', 85], ['Mie Ayam', 75], ['Es Teh Manis', 15]],
  katering: [['Paket Harian', 120], ['Paket Mingguan', 750]],
  frozen: [['Bakso Frozen', 160], ['Dimsum Ayam', 120], ['Nugget', 110]],
  toko: [['Indomie Goreng', 15], ['Kopi Sachet', 10], ['Teh Kotak', 20]],
  jasa: [['Laundry per kg', 40], ['Setrika per kg', 30]],
  jastip: [['Titip barang', 100], ['Ongkir per kg', 350]],
  pulsa: [['Pulsa 50', 55], ['Paket data 10 GB', 150]],
  lainnya: [],
};

type Row = { key: string; name: string; price: string };

export function OnboardingPage() {
  const { user } = useSession();
  const { businesses, selectBusiness } = useBusinessState();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  const addingAnother = params.get('baru') === '1';

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState('');
  const [owner, setOwner] = useState(user?.name ?? '');
  const [type, setType] = useState<BusinessType>('makanan');
  const [rows, setRows] = useState<Row[]>([{ key: uuid(), name: '', price: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!addingAnother && businesses.length > 0 && step === 0) return <Navigate to="/" replace />;

  const go = (next: number) => {
    setError(null);
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const ctx = await api.createBusiness(name.trim(), type, owner.trim() || null);
      const products = rows.filter((r) => r.name.trim() && parseAmount(r.price) !== null);
      for (const r of products) {
        await api.upsertProduct(ctx.business.id, {
          name: r.name.trim(),
          category_id: ctx.categories[0]?.id ?? null,
          sku: null,
          unit: 'pcs',
          price: parseAmount(r.price)!,
          cost_price: 0,
          track_stock: false,
          min_stock: 0,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['businesses'] });
      selectBusiness(ctx.business.id);
      go(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat usaha.');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 0) {
      if (!name.trim()) return setError('Isi nama usahamu dulu.');
      return go(1);
    }
    if (step === 1 || step === 2) return go(step + 1);
    if (step === 3) return void finish();
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-[72px] max-w-[640px] items-center justify-between px-5">
        <Logo />
        {step < 4 && <span className="text-[13px] font-semibold text-ink-3 tabular">Langkah {step + 1} dari 4</span>}
      </header>
      <div className="mx-auto max-w-[640px] px-5 pb-16">
        {step < 4 && (
          <div className="mb-8 grid grid-cols-4 gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-colors duration-300', i <= step ? 'bg-brand' : 'bg-surface-3')} />
            ))}
          </div>
        )}
        <motion.form
          key={step}
          onSubmit={onSubmit}
          noValidate
          initial={{ opacity: 0, x: reduced ? 0 : dir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
        >
          {step === 0 && (
            <div className="grid gap-5">
              <div>
                <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em]">Nama usahamu apa?</h1>
                <p className="mt-2 text-[15px] text-ink-2">Muncul di struk dan laporan. Bisa diganti nanti.</p>
              </div>
              <Field label="Nama usaha" htmlFor="ob-name">
                <TextInput id="ob-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Misal: Dapur Ahmad" />
              </Field>
              <Field label="Nama kamu" htmlFor="ob-owner" optional hint="Tampil sebagai kasir di setiap transaksi.">
                <TextInput id="ob-owner" value={owner} onChange={(e) => setOwner(e.target.value)} maxLength={80} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5">
              <div>
                <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em]">Jualan apa?</h1>
                <p className="mt-2 text-[15px] text-ink-2">Dipakai untuk kategori awal. Semua jenis usaha dapat fitur yang sama.</p>
              </div>
              <div role="radiogroup" aria-label="Jenis usaha" className="grid gap-2.5 sm:grid-cols-2">
                {TYPES.map((t) => (
                  <OptionCard
                    key={t.value}
                    selected={type === t.value}
                    onClick={() => setType(t.value)}
                    icon={<t.icon size={22} weight={type === t.value ? 'fill' : 'regular'} />}
                    title={t.label}
                    description={t.hint}
                    className="min-h-[64px]"
                  />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5">
              <div>
                <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em]">Semua pakai Pound Mesir</h1>
                <p className="mt-2 text-[15px] text-ink-2">Harga, uang masuk, piutang, dan laporan dihitung dalam EGP dengan waktu Kairo.</p>
              </div>
              <div className="flex items-center gap-4 rounded-[20px] bg-lime p-5 text-on-lime" role="radio" aria-checked="true">
                <span className="grid size-12 place-items-center rounded-full bg-surface/70 text-[15px] font-extrabold">EGP</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold">Pound Mesir (EGP)</span>
                  <span className="block text-[13px] opacity-80">Contoh tampilan: {formatMoney(1250)}</span>
                </span>
                <Check size={22} weight="bold" />
              </div>
              <p className="text-[13.5px] text-ink-3">Metode bayar bawaan: Cash, InstaPay, Vodafone Cash, dan Hutang. Orange Cash, Etisalat Cash, dan transfer bank bisa dinyalakan di Pengaturan.</p>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-5">
              <div>
                <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em]">Tambah produk pertama</h1>
                <p className="mt-2 text-[15px] text-ink-2">Cukup nama dan harga. Modal dan stok bisa dilengkapi nanti, atau lewati saja dan pakai jual cepat.</p>
              </div>
              {SUGGESTIONS[type].length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS[type].map(([n, p]) => (
                    <Chip
                      key={n}
                      icon={<Plus size={14} weight="bold" />}
                      onClick={() =>
                        setRows((rs) => {
                          const empty = rs.find((r) => !r.name.trim());
                          const row = { key: uuid(), name: n, price: String(p) };
                          return empty ? rs.map((r) => (r.key === empty.key ? { ...row, key: r.key } : r)) : [...rs, row];
                        })
                      }
                    >
                      {n}
                    </Chip>
                  ))}
                </div>
              )}
              <ul className="grid gap-3">
                {rows.map((r, i) => (
                  <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_140px_40px] items-end gap-2">
                    <Field label={`Produk ${i + 1}`} htmlFor={`ob-p-${r.key}`}>
                      <TextInput id={`ob-p-${r.key}`} value={r.name} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)))} maxLength={80} />
                    </Field>
                    <Field label="Harga" htmlFor={`ob-h-${r.key}`}>
                      <MoneyInput id={`ob-h-${r.key}`} value={r.price} onValueChange={(t) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, price: t } : x)))} />
                    </Field>
                    <button
                      type="button"
                      aria-label={`Hapus produk ${i + 1}`}
                      disabled={rows.length === 1}
                      onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                      className="grid h-12 place-items-center rounded-full text-ink-3 hover:bg-surface-2 disabled:opacity-30"
                    >
                      <Trash size={18} />
                    </button>
                  </li>
                ))}
              </ul>
              {rows.length < 6 && (
                <Button variant="ghost" size="sm" icon={<Plus size={16} weight="bold" />} className="justify-self-start" onClick={() => setRows((rs) => [...rs, { key: uuid(), name: '', price: '' }])}>
                  Tambah baris
                </Button>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center pt-10 text-center">
              <div className="success-pop grid size-16 place-items-center rounded-full bg-brand text-on-brand">
                <Check size={32} weight="bold" />
              </div>
              <h1 className="mt-6 text-[30px] font-bold leading-tight tracking-[-0.03em]">Siap jualan</h1>
              <p className="mt-2 max-w-[36ch] text-[15px] text-ink-2">{name} sudah dibuat. Transaksi pertama tinggal beberapa ketukan.</p>
              <div className="mt-8 grid w-full max-w-[320px] gap-2">
                <Button size="lg" block onClick={() => navigate('/kasir', { replace: true })}>
                  Buka kasir
                </Button>
                <Button variant="secondary" size="lg" block onClick={() => navigate('/', { replace: true })}>
                  Lihat beranda
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-[12px] bg-danger-soft px-4 py-3 text-[14px] font-medium text-danger-ink">
              {error}
            </p>
          )}

          {step < 4 && (
            <div className="mt-8 flex items-center justify-between gap-3">
              {step > 0 ? (
                <Button variant="ghost" icon={<ArrowLeft size={17} weight="bold" />} onClick={() => go(step - 1)}>
                  Kembali
                </Button>
              ) : addingAnother ? (
                <Button variant="ghost" onClick={() => navigate('/')}>
                  Batal
                </Button>
              ) : (
                <Link to="/gabung" className="text-[14px] font-semibold text-brand hover:underline">
                  Punya kode undangan?
                </Link>
              )}
              <div className="flex gap-2">
                {step === 3 && (
                  <Button
                    variant="secondary"
                    loading={busy}
                    onClick={() => {
                      setRows([{ key: uuid(), name: '', price: '' }]);
                      void finish();
                    }}
                  >
                    Lewati
                  </Button>
                )}
                <Button type="submit" size="lg" loading={busy} loadingText="Membuat usaha…" iconRight={step < 3 ? <ArrowRight size={17} weight="bold" /> : <Check size={17} weight="bold" />}>
                  {step < 3 ? 'Lanjut' : 'Selesai'}
                </Button>
              </div>
            </div>
          )}
        </motion.form>
      </div>
    </div>
  );
}
