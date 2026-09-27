// Login pakai username. Supabase Auth tetap butuh email, jadi username diubah menjadi
// alamat internal yang tidak pernah dikirimi email. Akun lama yang daftar pakai email
// tetap bisa masuk dengan emailnya.
// Wajib: matikan "Confirm email" di Supabase (Authentication > Sign In / Providers > Email).
export const USERNAME_DOMAIN = 'user.possir.app';

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,18}[a-z0-9])$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** Pesan salah kalau username tidak valid, atau null kalau valid */
export function usernameError(input: string): string | null {
  const u = normalizeUsername(input);
  if (u.length < 3) return 'Username minimal 3 karakter.';
  if (u.length > 20) return 'Username maksimal 20 karakter.';
  if (!USERNAME_RE.test(u)) return 'Pakai huruf kecil, angka, titik, atau garis bawah. Tanpa spasi.';
  return null;
}

/** Username atau email lama menjadi email untuk Supabase Auth */
export function toAuthEmail(identifier: string): string {
  const v = normalizeUsername(identifier);
  return v.includes('@') ? v : `${v}@${USERNAME_DOMAIN}`;
}

/** Tampilkan username untuk akun username, email untuk akun lama */
export function loginLabel(email: string | null | undefined): string | null {
  if (!email) return null;
  const suffix = `@${USERNAME_DOMAIN}`;
  return email.endsWith(suffix) ? `@${email.slice(0, -suffix.length)}` : email;
}
