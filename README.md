# Possir

Kasir, stok, piutang, pengeluaran, dan laporan untuk usaha mahasiswa Indonesia di Mesir.
Semua pakai EGP, waktu Kairo, bahasa Indonesia, dan nyaman dipakai dari HP.

> Inti produknya: *"Hari ini jual apa, dapat uang berapa, stok tinggal berapa, siapa yang
> masih ngutang, dan sebenarnya untung berapa?"*

## Coba dalam 1 menit (mode demo)

```bash
npm install
npm run dev
```

Buka http://localhost:5173 lalu pilih **Lihat demo**. Demo menjalankan Postgres asli di browser
(PGlite) dengan skema SQL yang sama persis dengan Supabase, berisi 5 minggu data contoh
"Pasar Asia Ahmad" (toko barang Indonesia dan Asia). Data demo hanya tersimpan di browser itu. Kunjungan pertama mengunduh mesin
database sekitar 10 MB; berikutnya langsung terbuka.

## Hubungkan ke Supabase

1. Buat project di [supabase.com](https://supabase.com). Pilih region terdekat dari Mesir
   (misalnya Frankfurt, `eu-central-1`).
2. Buka **SQL Editor > New query**, tempel seluruh isi [`supabase/possir.sql`](supabase/possir.sql),
   lalu **Run**. File ini gabungan tiga migrasi di `supabase/migrations/`:
   - `..._possir_tables.sql`: 20 tabel, index, trigger, Row Level Security
   - `..._possir_api.sql`: 45 fungsi RPC (semua logika bisnis)
   - `..._possir_storage.sql`: bucket foto produk + policy
   Kalau memakai Supabase CLI: `supabase link` lalu `supabase db push`.
3. **Authentication > URL Configuration**
   - Site URL: alamat aplikasi (saat lokal `http://localhost:5173`)
   - Redirect URLs: tambahkan `http://localhost:5173/**` dan domain produksi `https://domainmu/**`
     (dipakai tautan konfirmasi email dan atur ulang kata sandi `/atur-sandi`)
   - Opsional: matikan *Confirm email* di **Authentication > Providers > Email** kalau ingin
     pengguna langsung masuk setelah daftar.
4. Salin `.env.example` menjadi `.env`, isi dari **Project Settings > API**:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ... (atau sb_publishable_...)
   ```
5. `npm run dev`, lalu **Daftar**. Setelah daftar, onboarding membuat usaha pertama.

Kunci anon/publishable aman dipakai di browser: tabel dilindungi RLS dan semua penulisan
hanya bisa lewat fungsi RPC yang memeriksa keanggotaan dan peran.

## Fitur

| PRD | Status |
| --- | --- |
| Login, daftar, lupa kata sandi | Supabase Auth (email + kata sandi) |
| Buat toko (onboarding 5 langkah) | Nama, jenis usaha, EGP, produk pertama, siap jualan |
| Dashboard | Penjualan hari ini vs kemarin di jam yang sama, grafik 7 hari, laba kotor, modal, uang masuk, pengeluaran, piutang, stok menipis, terlaris, transaksi terakhir |
| Kasir + jual cepat | Katalog dengan pencarian dan kategori, keranjang tersimpan di HP, ubah harga per item, diskon (angka atau %), catatan, pelanggan, uang diterima + kembalian, hutang dengan uang muka dan janji bayar |
| Stok otomatis | Setiap penjualan/void/pembelian tercatat di mutasi stok. Stok boleh minus (penjualan nyata tetap tercatat, kasir diberi peringatan) |
| Riwayat + void | Filter tanggal dan status, cari, detail struk, kirim struk WhatsApp, void dengan alasan + tahan untuk konfirmasi (stok dan piutang dikembalikan) |
| Metode bayar Mesir | Cash, InstaPay, Vodafone Cash, Orange Cash, Etisalat Cash, Transfer Bank, Hutang, plus metode sendiri; bisa dinyalakan/dimatikan |
| Pelanggan + piutang | Buku kas bon per pelanggan, status Lunas/Sisa per belanja (FIFO), bayar sebagian, hutang manual, pengingat WhatsApp dengan template sendiri, tanda lewat janji |
| Pengeluaran | Kategori (gas, bahan baku, kemasan, transport, ongkir, listrik, sewa, iklan, ...), per bulan |
| Laporan harian & bulanan | Omzet, HPP, laba kotor, pengeluaran, laba bersih, uang masuk per metode, piutang, terlaris dengan laba, jam ramai, grafik harian |
| Export PDF, share WhatsApp | PDF dibuat di HP (jsPDF), ringkasan WhatsApp satu ketukan |
| V1.1: supplier, pembelian, stock adjustment, laba bersih, multi-user, audit log | Semua sudah ada: restock dari supplier (hutang supplier, harga modal ikut terbaru), stock opname/rusak/hilang/kedaluwarsa, kasir diundang dengan kode 8 karakter, riwayat aktivitas |

Peran **kasir**: bisa jualan, terima pembayaran hutang, dan melihat transaksinya sendiri. Tidak
bisa melihat modal, laba, laporan, pengeluaran, supplier, dan tidak bisa membatalkan transaksi.

## Arsitektur

```
React 19 + Vite 8 + Tailwind v4 (PWA, bisa dipasang di layar utama HP)
        │  supabase.rpc('create_sale', { p_business_id, p_sale })
        ▼
Backend (satu antarmuka)
  ├─ Supabase: Postgres + Auth + Storage
  └─ Demo: PGlite (Postgres 18 WASM) di web worker, menjalankan migrasi SQL yang sama
```

- **RPC-first:** semua logika bisnis di fungsi Postgres `security definer` dengan `search_path`
  kosong. Satu transaksi = satu fungsi = atomik (penjualan, item, pembayaran, stok, piutang).
- **Idempoten:** setiap transaksi/pembayaran membawa `client_ref` dari HP. Kirim ulang saat
  sinyal putus-nyambung tidak membuat data dobel.
- **Void, bukan delete:** transaksi, pembayaran, pembelian, dan pengeluaran ditandai batal
  lengkap dengan siapa, kapan, dan alasannya. Jejak ada di `audit_logs`.
- **Uang** `numeric(12,2)`, **jumlah** `numeric(12,3)` (bisa 0,5 kg). Nama, harga, dan modal
  disalin ke item transaksi supaya laporan lama tidak berubah.
- **Waktu:** semua pengelompokan tanggal di zona waktu usaha (`Africa/Cairo`, termasuk DST Mesir).

### Tabel

`profiles`, `businesses`, `business_members`, `business_invites`, `payment_methods`,
`categories`, `products`, `customers`, `suppliers`, `sales`, `sale_items`, `sale_payments`,
`customer_debts`, `debt_payments`, `purchases`, `purchase_items`, `supplier_payments`,
`expenses`, `stock_movements`, `audit_logs`.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` | Cek tipe + build produksi ke `dist/` |
| `npm run test:sql` | 94 tes skema di PGlite: uang, stok, piutang, void, idempotensi, izin kasir, RLS, zona waktu |
| `npm run test:seed` | Cek data demo konsisten dan realistis |
| `npm run sql:bundle` | Gabungkan migrasi ke `supabase/possir.sql` |
| `npm run icons` | Buat ulang ikon PWA |

## Deploy

Situs statis (SPA). `vercel.json` dan `public/_redirects` (Netlify) sudah mengarahkan semua rute
ke `index.html`. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di environment variables
hosting, lalu build dengan `npm run build`.

## Berikutnya (V2 di PRD)

- **Mode offline:** mesin demo membuktikan skema yang sama bisa jalan di HP. Jalurnya: PGlite
  lokal sebagai cache + antrean transaksi (sudah idempoten lewat `client_ref`) yang disinkronkan
  ke Supabase saat sinyal kembali.
- Scanner barcode (kolom `sku` sudah ada), printer thermal, multi-outlet, otomasi WhatsApp.

Desain: lihat [DESIGN.md](DESIGN.md).
