import { Compass } from '@phosphor-icons/react';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/display';

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="card w-full max-w-[420px]">
        <EmptyState icon={<Compass size={26} />} title="Halaman tidak ditemukan" action={<ButtonLink to="/">Ke beranda</ButtonLink>}>
          Tautannya mungkin salah ketik atau halamannya sudah dipindah.
        </EmptyState>
      </div>
    </div>
  );
}
