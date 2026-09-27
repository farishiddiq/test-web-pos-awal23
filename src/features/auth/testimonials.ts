// TODO: ganti dengan testimoni asli pengguna Possir (dengan izin mereka) sebelum dipromosikan.
// Isi di bawah ini contoh penulisan, bukan ulasan sungguhan.
export interface Testimonial {
  quote: string;
  name: string;
  business: string;
  place: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'Dulu hutang customer cuma diingat. Sekarang tinggal buka Piutang, kirim pengingat WhatsApp, beres.',
    name: 'Rizka Amalia',
    business: 'Katering rumahan',
    place: 'Hay Asyir',
  },
  {
    quote: 'Tiap malam saya lihat laba bersih. Ternyata ongkos gas dan kemasan makan untung lebih banyak dari dugaan.',
    name: 'Faiz Ramadhan',
    business: 'Frozen food',
    place: 'Madinat Nasr',
  },
  {
    quote: 'Pembeli bayar pakai InstaPay atau Vodafone Cash, semua tercatat terpisah. Tutup buku jadi cepat.',
    name: 'Hanifah Zahra',
    business: 'Jastip dan camilan',
    place: 'Tabbah',
  },
  {
    quote: 'Adik tingkat yang jaga kasir cukup pakai HP sendiri. Saya bisa cek dari kampus.',
    name: 'Muhammad Iqbal',
    business: 'Warung bakso',
    place: 'Bawwabah',
  },
];
