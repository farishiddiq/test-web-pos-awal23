// Foto produk dikecilkan di HP sebelum diunggah: hemat kuota internet dan penyimpanan
export async function resizeImage(file: File, maxSize: number, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak bisa memproses gambar.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
  // Safari lama belum bisa membuat webp; pakai jpeg kalau begitu
  const webp = await toBlob('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await toBlob('image/jpeg');
  if (!jpeg) throw new Error('Gagal mengolah foto.');
  return jpeg;
}
