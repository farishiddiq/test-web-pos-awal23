# Design System: Possir

Kasir untuk usaha mahasiswa Indonesia di Mesir. Dokumen ini adalah sumber kebenaran visual
untuk layar baru (termasuk bila dibuat lewat Google Stitch): atmosfer, token, komponen, dan
aturan gerak. Nilai di sini sama dengan `src/styles/index.css`.

**Design read:** aplikasi POS mobile-first (product UI, bukan landing page) untuk pemilik usaha
rumahan Masisir, dengan bahasa visual kartu lembut yang tenang dan ramah, berbasis Tailwind v4,
Phosphor icons, Vaul, Sonner, dan Motion.

**Dial:** `DESIGN_VARIANCE 4` (produk harian butuh pola yang bisa ditebak),
`MOTION_INTENSITY 3` (dipakai puluhan kali sehari, gerak harus hemat),
`VISUAL_DENSITY 5` (seimbang: angka jelas, tidak sesak).

## 1. Visual Theme & Atmosphere

Tenang, hangat, dan praktis, seperti buku catatan warung yang rapi. Latar abu-hijau lembut
(bukan krem), kartu putih berdiameter sudut besar, satu aksen hijau Nil untuk tindakan, dan
lime untuk "sedang dipilih". Angka uang selalu jadi elemen paling besar di layar. Mode gelap
dirancang terpisah (bukan dibalik otomatis) dan diuji kontrasnya.

Referensi yang membentuk arah ini: POS restoran berkartu produk + panel pesanan di kanan,
dashboard Niond/Starline dengan pill navigasi lime dan kartu statistik pastel, Bitepoint untuk
kartu pesanan bersih.

## 2. Color Palette & Roles

Semua pasangan teks sudah dihitung: teks >= 4.5:1, batas input >= 3:1 (WCAG AA).

| Token | Terang | Gelap | Peran |
| --- | --- | --- | --- |
| Canvas | `#EEF1EC` | `#0D1310` | Latar halaman |
| Surface | `#FBFCFA` | `#141C18` | Kartu, sheet, sidebar |
| Surface 2 / 3 | `#F3F5F1` / `#E7EBE6` | `#1A241F` / `#22302A` | Isian, hover, skeleton |
| Line | `#E1E6E0` | `#25312B` | Garis pemisah tipis (dekoratif) |
| Field | `#86928B` | `#65746C` | Batas input (3.1:1 / 3.5:1) |
| Ink | `#15201B` | `#E8EFEA` | Teks utama |
| Ink 2 | `#4B5852` | `#A8B6AE` | Teks sekunder |
| Ink 3 | `#5E6A64` | `#8B9991` | Label, metadata (>= 4.5:1) |
| **Nil (brand)** | `#1E6A51` | `#58C29A` | Tombol utama, angka positif, kolom grafik yang disorot |
| Brand soft / ink | `#DCEEE5` / `#104A38` | `#173A2E` / `#9EE3C6` | Badge "Lunas", delta naik |
| **Lime** | `#D4F26B` | `#CBEA5E` | Hanya untuk "sedang dipilih": navigasi aktif, chip terpilih, metode bayar terpilih, kembalian |
| Danger | `#B3392C` | `#F08A7E` | Void, error, stok habis |
| Warn soft / ink | `#FCEFD3` / `#8A5600` | `#33270F` / `#F0C46A` | Stok menipis, hutang |

**Tint kategori** (ikon dan kartu statistik, bukan status): lime, mint, sky, sand, peach,
rose, stone. Setiap tint punya pasangan bg/fg dengan kontras >= 6:1. Piutang selalu peach,
stok menipis rose, laba mint, modal sky.

**Aturan:** satu aksen tindakan (Nil). Lime bukan aksen kedua, melainkan penanda seleksi dari
keluarga hijau yang sama. Tidak ada gradien ungu, tidak ada glow, tidak ada hitam/putih murni.

## 3. Typography Rules

- **Font:** Plus Jakarta Sans Variable (dirancang Tokotype di Jakarta, sentuhan asal pengguna).
  Self-hosted lewat `@fontsource-variable`, tanpa `<link>` Google Fonts.
- **Judul halaman:** 26px mobile, 30px desktop, tebal 700, tracking -0.025em.
- **Angka pahlawan** (penjualan hari ini, laba bersih): 44-54px, 700, tracking -0.035em,
  digit proporsional. Awalan "EGP" 0.7em, opacity 75%.
- **Kolom angka** (daftar, tabel, sumbu grafik): `tabular-nums` (sudah diverifikasi didukung font).
- **Isi:** 15px, leading 1.5. Input 16px supaya Safari iOS tidak zoom.
- Format angka Indonesia: `EGP 1.250`, desimal pakai koma, desimal hanya bila ada piaster.
- Tanpa font serif, tanpa em-dash di teks antarmuka, titik tengah maksimal satu per baris.

## 4. Component Stylings

- **Radius (dikunci):** kartu 24px, sheet 28px, petak produk/tile 16-22px, input 14px,
  semua tombol, chip, dan kontrol segmen berbentuk pil penuh.
- **Tombol:** primary = Nil, secondary = surface 2, ghost, danger (danger-soft). Tinggi 36/44/56px.
  Tekan: `scale(0.97)` 160ms `cubic-bezier(0.23, 1, 0.32, 1)`, hanya bila gerak diizinkan.
  Status memuat mengganti label ("Menyimpan…"), bukan spinner.
- **Chip:** tidak terpilih = surface + garis; terpilih = lime.
- **Kontrol segmen:** gaya iOS, pill surface di atas track abu.
- **Kartu:** surface, bayangan diwarnai hijau-tinta (`rgb(21 32 27 / 0.2)`), bukan hitam.
- **Input:** label di atas, petunjuk/error di bawah, fokus cincin Nil 3px. Input uang punya
  awalan "EGP", keyboard desimal, dan pratinjau format untuk angka >= 1.000.
- **Sheet:** Vaul. HP = bottom sheet bisa ditarik; tablet/desktop = panel mengambang dari kanan.
  Isi tetap tampil selama animasi keluar.
- **Tahan untuk konfirmasi:** untuk void transaksi, pembayaran, pembelian. Isian merah
  `clip-path` 1.1s linear saat ditahan, kembali 200ms ease-out; label ikut terpotong.
- **Petak produk tanpa foto:** kotak kecil berinisial dengan tint stabil dari nama.
- **Loading:** skeleton sesuai bentuk akhir. **Kosong:** ikon + judul + ajakan. **Error:** inline
  dengan tombol "Coba lagi"; gagal simpan lewat toast.

## 5. Layout Principles

- Mobile-first. Di bawah 768px: satu kolom, navigasi bawah translusen (material blur) dengan
  tombol Kasir lime di tengah. 768-1279px: sidebar ikon 84px. >= 1280px: sidebar penuh 252px.
- Kasir: katalog + panel pesanan tetap di kanan (360/400px) di layar lebar; di HP bar keranjang
  mengambang lalu bottom sheet. Grid produk memakai container query, bukan lebar layar.
- Grid halaman selalu `grid-cols-1` di HP (`minmax(0,1fr)`) supaya teks panjang terpotong,
  bukan melebarkan halaman. Sudah diuji: 11 halaman tanpa scroll horizontal di 375px.
- Konten dibatasi 1240px. Sentuhan minimal 44px (IconButton memperluas area sentuh).

## 6. Motion & Interaction

Diputuskan dengan gerbang *find-animation-opportunities* (frekuensi, tujuan, durasi, fungsi).
Istilah mengikuti *animation-vocabulary*.

| Momen | Frekuensi | Tujuan | Gerak |
| --- | --- | --- | --- |
| Tombol, kartu produk | puluhan/hari | Feedback | Press feedback `scale(0.97)` 160ms ease-out |
| Sheet (checkout, form) | sesekali | Spatial consistency | Slide in/out lewat jalur yang sama (Vaul), bisa swipe to dismiss |
| Bar keranjang di HP | sekali per transaksi | Preventing a jarring change | Enter `translateY(16px)`+fade 200ms via `@starting-style` |
| Tanda sukses transaksi | sekali per transaksi | Feedback | Scale in dari 0.9 (bukan 0) + fade 240ms |
| Langkah onboarding | sekali seumur akun | Direction-aware transition | Masuk 24px dari arah langkah, 240ms (Motion) |
| Tahan untuk konfirmasi | jarang | Hold to confirm | clip-path fill linear, lepas cepat |
| Skeleton | saat memuat | Perceived performance | Shimmer, berhenti saat reduced motion |

**Ditolak dengan sengaja:**
- Transisi antarhalaman dan antartab navigasi: dipakai 100+ kali sehari.
- Animasi baris keranjang saat item ditambah: aksi paling sering di aplikasi.
- Number ticker di angka penjualan/laba: data yang sedang dibaca tidak boleh bergerak.
- Grafik batang "tumbuh" saat dimuat: fungsional, bukan dekorasi.
- Pulse pada badge stok menipis dan micro-loop "perpetual": mengganggu di layar kerja harian.

Reduced motion: gerak transform dihapus, fade dan perubahan warna dipertahankan.
`prefers-reduced-transparency` membuat material navigasi jadi padat.

## 7. Data Visualization

- Bentuk dipilih dari tugas data: angka pahlawan untuk satu nilai, KPI tile untuk beberapa
  angka, kolom satu seri untuk tren harian/jam, daftar + bar tipis satu warna untuk
  perbandingan (metode bayar, kategori pengeluaran). Tidak ada donut, tidak ada palet pelangi.
- Kolom maksimal 24px, ujung data membulat 4px, persegi di garis dasar, grid hairline solid.
- Emphasis: hari ini / hari terbaik berwarna Nil, sisanya abu konteks.
- Tooltip per kolom (hover, sentuh, panah kiri/kanan), plus tabel tersembunyi untuk pembaca layar.

## 8. Anti-Patterns (dilarang)

Emoji di UI, font Inter atau serif, hitam/putih murni, glow neon, gradien teks, tiga kartu fitur
identik di landing, spinner lingkaran, placeholder sebagai label, em-dash di teks, nama generik
(John Doe, Acme), angka palsu yang terlalu bulat, ikon SVG buatan tangan (selain logo geometris),
animasi dekoratif di layar yang dipakai berulang, satu angka dalam dua warna berbeda arti.
