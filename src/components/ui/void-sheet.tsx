import { useEffect, useState, type ReactNode } from 'react';
import { Sheet } from './sheet';
import { Field, TextInput } from './form';
import { HoldButton } from './hold-button';

/** Konfirmasi pembatalan dengan alasan wajib + tahan untuk konfirmasi */
export function VoidSheet({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  onConfirm: (reason: string) => Promise<void> | void;
  busy?: boolean;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <HoldButton disabled={!reason.trim() || busy} onConfirm={() => onConfirm(reason.trim())}>
          {busy ? 'Membatalkan…' : 'Tahan untuk membatalkan'}
        </HoldButton>
      }
    >
      <div className="grid gap-4">
        <div className="rounded-[16px] bg-warn-soft p-4 text-[14px] text-warn-ink">{description}</div>
        <Field label="Alasan" htmlFor="void-reason">
          <TextInput id="void-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={180} placeholder="Misal: salah catat" />
        </Field>
      </div>
    </Sheet>
  );
}
