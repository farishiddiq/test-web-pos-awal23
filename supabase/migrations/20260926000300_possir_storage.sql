-- =====================================================================
-- POSSIR - skema database (bagian 3 dari 3): Storage foto produk
--
-- Bucket publik "product-images". Struktur path: {business_id}/{nama}.webp
-- Hanya pemilik usaha yang boleh mengunggah, mengganti, dan menghapus.
-- Siapa pun yang punya URL bisa melihat fotonya (seperti foto menu).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Folder pertama harus UUID usaha milik pengguna. CASE menjamin cast uuid
-- hanya dijalankan kalau formatnya benar.
create or replace function private.can_manage_product_image(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (storage.foldername(p_object_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.is_owner(((storage.foldername(p_object_name))[1])::uuid)
    else false
  end;
$$;

grant execute on function private.can_manage_product_image(text) to authenticated;

drop policy if exists "possir: pemilik unggah foto produk" on storage.objects;
drop policy if exists "possir: pemilik ganti foto produk" on storage.objects;
drop policy if exists "possir: pemilik hapus foto produk" on storage.objects;

create policy "possir: pemilik unggah foto produk" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and private.can_manage_product_image(name));

create policy "possir: pemilik ganti foto produk" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and private.can_manage_product_image(name))
  with check (bucket_id = 'product-images' and private.can_manage_product_image(name));

create policy "possir: pemilik hapus foto produk" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and private.can_manage_product_image(name));
