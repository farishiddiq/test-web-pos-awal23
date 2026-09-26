import { useNavigate } from 'react-router';
import { Check, Plus, UsersThree } from '@phosphor-icons/react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useBusiness } from '@/data/business';
import { BUSINESS_TYPE_LABEL } from '@/lib/labels';

export function BusinessSwitcherSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { businesses, businessId, selectBusiness } = useBusiness();
  const navigate = useNavigate();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Pilih usaha" description="Satu akun bisa mengelola beberapa usaha.">
      <ul className="grid gap-2" role="radiogroup" aria-label="Usaha">
        {businesses.map((b) => {
          const active = b.id === businessId;
          return (
            <li key={b.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  selectBusiness(b.id);
                  onOpenChange(false);
                  navigate('/');
                }}
                className={`pressable flex w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left ${active ? 'border-transparent bg-lime text-on-lime' : 'border-line hover:bg-surface-2'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{b.name}</span>
                  <span className={`block text-[12.5px] ${active ? 'text-on-lime/75' : 'text-ink-3'}`}>
                    {BUSINESS_TYPE_LABEL[b.business_type]}, {b.role === 'owner' ? 'pemilik' : 'kasir'}
                  </span>
                </span>
                {active && <Check size={18} weight="bold" />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 grid gap-2">
        <Button
          variant="secondary"
          icon={<Plus size={17} weight="bold" />}
          onClick={() => {
            onOpenChange(false);
            navigate('/mulai?baru=1');
          }}
        >
          Buat usaha baru
        </Button>
        <Button
          variant="ghost"
          icon={<UsersThree size={18} />}
          onClick={() => {
            onOpenChange(false);
            navigate('/gabung');
          }}
        >
          Gabung ke usaha lain dengan kode
        </Button>
      </div>
    </Sheet>
  );
}
