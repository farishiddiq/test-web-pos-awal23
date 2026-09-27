import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ArrowCounterClockwise, CaretDown, Copy, PencilSimple, Plus, SignOut, Trash, UserPlus, WhatsappLogo, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Page, BUSINESS_TYPE_LABEL } from '@/components/layout/app-shell';
import { Button, IconButton } from '@/components/ui/button';
import { Segmented } from '@/components/ui/choice';
import { Field, SwitchRow, TextArea, TextInput, inputClass } from '@/components/ui/form';
import { Avatar, Badge, PageHeader, Skeleton } from '@/components/ui/display';
import { useBusiness } from '@/data/business';
import { useSession } from '@/data/session';
import { loginLabel } from '@/lib/username';
import {
  useAddPaymentMethod,
  useAuditLogs,
  useCreateInvite,
  useDeleteCategory,
  useMembers,
  useRemoveMember,
  useRevokeInvite,
  useSetPaymentMethod,
  useUpdateBusiness,
  useUpdateMyProfile,
  useUpsertCategory,
} from '@/data/queries';
import type { AuditLog, BusinessType } from '@/data/types';
import { useTheme, type ThemePref } from '@/lib/theme';
import { DEFAULT_REMINDER_TEMPLATE, fillReminder } from '@/lib/share-text';
import { formatDateMedium, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { openWhatsApp } from '@/lib/phone';

function Section({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card p-5 md:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold tracking-[-0.01em]">{title}</h2>
          {description && <p className="mt-1 text-[13.5px] text-ink-3">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function PengaturanPage() {
  const { isOwner } = useBusiness();
  const { mode } = useSession();
  return (
    <Page className="max-w-[860px]">
      <PageHeader title="Pengaturan" />
      <div className="mt-6 grid gap-4">
        <AccountSection />
        {isOwner && (
          <>
            <BusinessSection />
            <PaymentMethodsSection />
            <CategoriesSection />
            <ReminderSection />
            <MembersSection />
            <ActivitySection />
          </>
        )}
        {mode === 'demo' && <DemoSection />}
        <p className="py-2 text-center text-[12.5px] text-ink-3">Possir 0.1. Data tersimpan di {mode === 'demo' ? 'browser ini (mode demo)' : 'Supabase'}.</p>
      </div>
    </Page>
  );
}

function AccountSection() {
  const { context } = useBusiness();
  const { user, signOut } = useSession();
  const updateProfile = useUpdateMyProfile();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();
  const [name, setName] = useState(context.me.display_name);

  return (
    <Section title="Akun" description={loginLabel(user?.email) ?? undefined}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await updateProfile.mutateAsync(name.trim());
          toast.success('Nama diperbarui');
        }}
      >
        <Field label="Nama yang tampil di struk dan transaksi" htmlFor="acc-name" className="min-w-[220px] flex-1">
          <TextInput id="acc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Button type="submit" variant="secondary" disabled={name.trim() === context.me.display_name || !name.trim()} loading={updateProfile.isPending}>
          Simpan
        </Button>
      </form>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-ink-2">Tampilan</p>
          <Segmented<ThemePref>
            label="Tema"
            className="mt-2"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'system', label: 'Ikuti HP' },
              { value: 'light', label: 'Terang' },
              { value: 'dark', label: 'Gelap' },
            ]}
          />
        </div>
        <Button
          variant="ghost"
          icon={<SignOut size={18} />}
          onClick={async () => {
            await signOut();
            navigate('/masuk');
          }}
        >
          Keluar
        </Button>
      </div>
    </Section>
  );
}

function BusinessSection() {
  const { context } = useBusiness();
  const update = useUpdateBusiness();
  const b = context.business;
  const [name, setName] = useState(b.name);
  const [type, setType] = useState<BusinessType>(b.business_type);
  const [phone, setPhone] = useState(b.phone ?? '');
  const [address, setAddress] = useState(b.address ?? '');
  const [footer, setFooter] = useState(b.receipt_footer ?? '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await update.mutateAsync({ name: name.trim(), business_type: type, phone: phone.trim(), address: address.trim(), receipt_footer: footer.trim() });
    toast.success('Profil usaha disimpan');
  };

  return (
    <Section title="Profil usaha" description="Muncul di struk dan laporan yang dibagikan.">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Nama usaha" htmlFor="b-name">
          <TextInput id="b-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Jenis usaha" htmlFor="b-type">
          <select id="b-type" value={type} onChange={(e) => setType(e.target.value as BusinessType)} className={inputClass}>
            {Object.entries(BUSINESS_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nomor WhatsApp usaha" htmlFor="b-phone" optional>
          <TextInput id="b-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Alamat singkat" htmlFor="b-address" optional>
          <TextInput id="b-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} placeholder="Misal: Hay Asyir, Nasr City" />
        </Field>
        <Field label="Catatan di akhir struk" htmlFor="b-footer" optional className="sm:col-span-2">
          <TextInput id="b-footer" value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={200} placeholder="Terima kasih! Pesan lagi lewat WA ya." />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <p className="text-[13px] text-ink-3">Mata uang EGP, zona waktu Kairo.</p>
          <Button type="submit" disabled={!name.trim()} loading={update.isPending}>
            Simpan profil
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PaymentMethodsSection() {
  const { context } = useBusiness();
  const setMethod = useSetPaymentMethod();
  const addMethod = useAddPaymentMethod();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'wallet' | 'bank' | 'cash' | 'other'>('wallet');

  return (
    <Section title="Metode pembayaran" description="Hanya metode yang aktif yang muncul di kasir.">
      <div className="divide-y divide-line">
        {context.payment_methods.map((m) => (
          <SwitchRow
            key={m.code}
            title={m.name}
            description={m.kind === 'debt' ? 'Catat sebagai piutang pelanggan' : undefined}
            checked={m.is_active}
            disabled={setMethod.isPending}
            onChange={(active) => setMethod.mutate({ code: m.code, active })}
          />
        ))}
      </div>
      <form
        className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await addMethod.mutateAsync({ name: name.trim(), kind });
          setName('');
          toast.success('Metode bayar ditambahkan');
        }}
      >
        <Field label="Tambah metode lain" htmlFor="pm-name" className="min-w-[180px] flex-1">
          <TextInput id="pm-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Misal: WE Pay, Fawry" />
        </Field>
        <Field label="Jenis" htmlFor="pm-kind">
          <select id="pm-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputClass}>
            <option value="wallet">Dompet digital</option>
            <option value="bank">Bank / transfer</option>
            <option value="cash">Tunai</option>
            <option value="other">Lainnya</option>
          </select>
        </Field>
        <Button type="submit" variant="secondary" icon={<Plus size={17} weight="bold" />} disabled={!name.trim()} loading={addMethod.isPending}>
          Tambah
        </Button>
      </form>
    </Section>
  );
}

function CategoriesSection() {
  const { context } = useBusiness();
  const upsert = useUpsertCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <Section title="Kategori produk" description="Untuk mengelompokkan produk di kasir.">
      <ul className="divide-y divide-line">
        {context.categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            {editing?.id === c.id ? (
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editing.name.trim()) return;
                  await upsert.mutateAsync({ id: c.id, name: editing.name.trim() });
                  setEditing(null);
                }}
              >
                <TextInput aria-label="Nama kategori" autoFocus value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} className="h-10 text-[15px]" maxLength={40} />
                <Button type="submit" size="sm" loading={upsert.isPending} loadingText="…">
                  Simpan
                </Button>
                <IconButton label="Batal" size="sm" onClick={() => setEditing(null)}>
                  <X size={16} />
                </IconButton>
              </form>
            ) : (
              <>
                <span className="flex-1 text-[15px] font-semibold">{c.name}</span>
                <IconButton label={`Ubah ${c.name}`} size="sm" onClick={() => setEditing({ id: c.id, name: c.name })}>
                  <PencilSimple size={16} />
                </IconButton>
                {confirmDelete === c.id ? (
                  <Button
                    size="sm"
                    variant="danger"
                    loading={remove.isPending}
                    loadingText="…"
                    onClick={async () => {
                      await remove.mutateAsync(c.id);
                      setConfirmDelete(null);
                      toast.success(`Kategori ${c.name} dihapus. Produknya tetap ada.`);
                    }}
                  >
                    Yakin hapus?
                  </Button>
                ) : (
                  <IconButton label={`Hapus ${c.name}`} size="sm" onClick={() => setConfirmDelete(c.id)}>
                    <Trash size={16} />
                  </IconButton>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await upsert.mutateAsync({ name: name.trim() });
          setName('');
        }}
      >
        <Field label="Kategori baru" htmlFor="cat-new" className="flex-1">
          <TextInput id="cat-new" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Misal: Paket hemat" />
        </Field>
        <Button type="submit" variant="secondary" icon={<Plus size={17} weight="bold" />} disabled={!name.trim()}>
          Tambah
        </Button>
      </form>
    </Section>
  );
}

function ReminderSection() {
  const { context } = useBusiness();
  const update = useUpdateBusiness();
  const [template, setTemplate] = useState(context.business.debt_reminder_template ?? DEFAULT_REMINDER_TEMPLATE);
  const preview = fillReminder(template, { nama: 'Abdullah', toko: context.business.name, sisa: 150 });

  return (
    <Section title="Pesan pengingat hutang" description="Dipakai tombol Kirim pengingat di halaman piutang.">
      <Field label="Isi pesan" htmlFor="rem-template" hint="Kata {nama}, {toko}, dan {sisa} otomatis diganti.">
        <TextArea id="rem-template" rows={4} value={template} onChange={(e) => setTemplate(e.target.value)} maxLength={600} />
      </Field>
      <div className="mt-4 max-w-[420px] rounded-[18px] rounded-tl-[6px] bg-brand-soft p-4 text-[14px] leading-relaxed text-brand-ink">{preview}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          loading={update.isPending}
          disabled={template.trim() === (context.business.debt_reminder_template ?? DEFAULT_REMINDER_TEMPLATE)}
          onClick={async () => {
            await update.mutateAsync({ debt_reminder_template: template.trim() === DEFAULT_REMINDER_TEMPLATE ? '' : template.trim() });
            toast.success('Pesan pengingat disimpan');
          }}
        >
          Simpan pesan
        </Button>
        <Button variant="ghost" icon={<ArrowCounterClockwise size={17} />} onClick={() => setTemplate(DEFAULT_REMINDER_TEMPLATE)}>
          Kembalikan bawaan
        </Button>
      </div>
    </Section>
  );
}

function MembersSection() {
  const { context } = useBusiness();
  const { mode } = useSession();
  const members = useMembers();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const removeMember = useRemoveMember();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const shareInvite = (code: string, expires: string) =>
    openWhatsApp(
      `Assalamu'alaikum, kamu diundang jadi kasir di ${context.business.name} lewat Possir.\n\n1. Buka ${window.location.origin}/gabung\n2. Daftar atau masuk\n3. Masukkan kode: *${code}*\n\nKode berlaku sampai ${formatDateMedium(expires.slice(0, 10))}.`,
    );

  return (
    <Section
      title="Anggota dan kasir"
      description="Kasir bisa mencatat transaksi dan menerima pembayaran hutang, tapi tidak melihat modal, laba, dan laporan."
      action={
        <Button
          variant="secondary"
          size="sm"
          icon={<UserPlus size={16} />}
          loading={createInvite.isPending}
          onClick={async () => {
            const inv = await createInvite.mutateAsync('cashier');
            toast.success(`Kode undangan ${inv.code} dibuat`);
          }}
        >
          Undang kasir
        </Button>
      }
    >
      {mode === 'demo' && <p className="mb-3 rounded-[12px] bg-surface-2 px-3 py-2 text-[13px] text-ink-2">Di mode demo, kode undangan tidak bisa dipakai akun lain.</p>}
      {members.isPending ? (
        <Skeleton className="h-20" />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {(members.data?.members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.display_name ?? m.email ?? '?'} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold">
                    {m.display_name ?? 'Tanpa nama'} {m.is_me && <span className="font-medium text-ink-3">(kamu)</span>}
                  </p>
                  <p className="truncate text-[12.5px] text-ink-3">{loginLabel(m.email)}</p>
                </div>
                <Badge tone={m.role === 'owner' ? 'lime' : 'neutral'}>{m.role === 'owner' ? 'Pemilik' : 'Kasir'}</Badge>
                {!m.is_me &&
                  (confirmRemove === m.user_id ? (
                    <Button size="sm" variant="danger" loading={removeMember.isPending} loadingText="…" onClick={() => removeMember.mutate(m.user_id)}>
                      Keluarkan
                    </Button>
                  ) : (
                    <IconButton label={`Keluarkan ${m.display_name ?? ''}`} size="sm" onClick={() => setConfirmRemove(m.user_id)}>
                      <X size={16} />
                    </IconButton>
                  ))}
              </li>
            ))}
          </ul>
          {(members.data?.invites ?? []).length > 0 && (
            <div className="mt-4 grid gap-2">
              <p className="text-[13px] font-semibold text-ink-2">Undangan aktif</p>
              {members.data!.invites.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center gap-2 rounded-[16px] bg-surface-2 px-3.5 py-2.5">
                  <code className="rounded-[8px] bg-surface px-2 py-1 text-[15px] font-bold tracking-[0.12em]">{inv.code}</code>
                  <span className="flex-1 text-[12.5px] text-ink-3">sampai {formatDateMedium(inv.expires_at.slice(0, 10))}</span>
                  <IconButton
                    label="Salin kode"
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inv.code);
                        toast.success('Kode disalin');
                      } catch {
                        toast.error('Gagal menyalin. Salin manual ya.');
                      }
                    }}
                  >
                    <Copy size={16} />
                  </IconButton>
                  <IconButton label="Kirim lewat WhatsApp" size="sm" onClick={() => shareInvite(inv.code, inv.expires_at)}>
                    <WhatsappLogo size={16} weight="fill" />
                  </IconButton>
                  <IconButton label="Batalkan undangan" size="sm" onClick={() => revokeInvite.mutate(inv.id)}>
                    <Trash size={16} />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Section>
  );
}

const ACTION_LABEL: Record<string, (d: Record<string, unknown>) => string> = {
  'sale.void': (d) => `Membatalkan transaksi #${d.number} (${formatMoney(Number(d.total))}): ${d.reason}`,
  'stock.adjust': (d) => `Mengubah stok ${d.name}: ${d.before} jadi ${d.after}`,
  'product.price': (d) => `Mengubah harga ${d.name}: ${formatMoney(Number(d.old_price))} jadi ${formatMoney(Number(d.price))}`,
  'product.archive': () => 'Mengarsipkan produk',
  'product.restore': () => 'Mengaktifkan produk lagi',
  'product.delete': (d) => `Menghapus produk ${d.name}`,
  'debt.payment': (d) => `Mencatat pembayaran hutang ${formatMoney(Number(d.amount))}`,
  'debt.payment_void': (d) => `Membatalkan pembayaran hutang ${formatMoney(Number(d.amount))}: ${d.reason}`,
  'debt.manual': (d) => `Mencatat hutang manual ${formatMoney(Number(d.amount))}`,
  'debt.void': (d) => `Membatalkan hutang manual ${formatMoney(Number(d.amount))}: ${d.reason}`,
  'expense.update': (d) => `Mengubah pengeluaran ${d.category}`,
  'expense.void': (d) => `Menghapus pengeluaran ${d.category} ${formatMoney(Number(d.amount))}`,
  'purchase.create': (d) => `Mencatat pembelian #${d.number} (${formatMoney(Number(d.total))})`,
  'purchase.void': (d) => `Membatalkan pembelian #${d.number}: ${d.reason}`,
  'supplier.payment': (d) => `Membayar hutang supplier ${formatMoney(Number(d.amount))}`,
  'member.invite': () => 'Membuat kode undangan',
  'member.join': () => 'Bergabung sebagai anggota',
  'member.remove': () => 'Mengeluarkan anggota',
  'business.create': () => 'Membuat usaha',
  'business.update': () => 'Mengubah profil usaha',
};

function describe(log: AuditLog): string {
  const fn = ACTION_LABEL[log.action];
  return fn ? fn(log.details) : log.action;
}

function ActivitySection() {
  const { tz } = useBusiness();
  const [open, setOpen] = useState(false);
  const logs = useAuditLogs(open);
  return (
    <section className="card">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 p-5 text-left md:px-6">
        <span>
          <span className="block text-[17px] font-bold tracking-[-0.01em]">Riwayat aktivitas</span>
          <span className="mt-1 block text-[13.5px] text-ink-3">Siapa membatalkan transaksi, mengubah harga, atau stok.</span>
        </span>
        <CaretDown size={18} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <div className="border-t border-line px-5 pb-4 md:px-6">
          {logs.isPending ? (
            <Skeleton className="mt-4 h-24" />
          ) : (logs.data ?? []).length === 0 ? (
            <p className="py-4 text-[14px] text-ink-3">Belum ada aktivitas penting.</p>
          ) : (
            <ul className="divide-y divide-line">
              {logs.data!.map((log) => (
                <li key={log.id} className="py-2.5">
                  <p className="text-[14px]">{describe(log)}</p>
                  <p className="text-[12.5px] text-ink-3">
                    {log.actor_name ?? 'Sistem'}, {formatDateTime(log.created_at, tz)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function DemoSection() {
  const { resetDemo } = useSession();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Section title="Data demo" description="Kembalikan data contoh Pasar Asia Ahmad seperti awal. Semua perubahanmu di demo akan hilang.">
      <Button
        variant={confirm ? 'danger' : 'secondary'}
        icon={<ArrowCounterClockwise size={17} />}
        loading={busy}
        loadingText="Menyiapkan ulang…"
        onClick={async () => {
          if (!confirm) return setConfirm(true);
          setBusy(true);
          await resetDemo();
        }}
      >
        {confirm ? 'Ketuk lagi untuk reset' : 'Reset data demo'}
      </Button>
    </Section>
  );
}
