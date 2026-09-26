// Nomor WhatsApp: mahasiswa Masisir biasanya punya nomor Mesir (01x) atau
// nomor Indonesia (08x). wa.me butuh format internasional tanpa "+".
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (trimmed.startsWith('+')) return digits.length >= 8 ? digits : null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('01') && digits.length === 11) digits = `20${digits.slice(1)}`;
  else if (digits.startsWith('08') && digits.length >= 10 && digits.length <= 13) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('1') && digits.length === 10) digits = `20${digits}`;
  else if (digits.startsWith('8') && digits.length >= 9 && digits.length <= 12) digits = `62${digits}`;
  return digits.length >= 8 ? digits : null;
}

/** Tanpa nomor, WhatsApp akan meminta pengguna memilih kontak sendiri. */
export function whatsAppLink(text: string, phone?: string | null): string {
  const number = toWhatsAppNumber(phone);
  const query = `text=${encodeURIComponent(text)}`;
  return number ? `https://wa.me/${number}?${query}` : `https://wa.me/?${query}`;
}

export function openWhatsApp(text: string, phone?: string | null): void {
  window.open(whatsAppLink(text, phone), '_blank', 'noopener,noreferrer');
}
