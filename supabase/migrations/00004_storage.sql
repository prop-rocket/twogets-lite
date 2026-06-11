-- =============================================================================
-- TwoGets — 00004_storage.sql
-- Storage buckets + policies.
--   property-media          public   — listing photos & videos
--   verification-documents  private  — Aadhaar/PAN/ownership docs (admin + owner only)
--   avatars                 public   — profile pictures
-- All object paths are namespaced by the uploader's user id: {user_id}/...
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-media', 'property-media', true, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm']),
  ('verification-documents', 'verification-documents', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('avatars', 'avatars', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- property-media: world-readable, owner-managed within own folder
-- ---------------------------------------------------------------------------
create policy "property_media_read" on storage.objects
  for select using (bucket_id = 'property-media');

create policy "property_media_insert" on storage.objects
  for insert with check (
    bucket_id = 'property-media'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.current_user_role() in ('homeowner', 'admin')
  );

create policy "property_media_delete" on storage.objects
  for delete using (
    bucket_id = 'property-media'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- verification-documents: uploader writes own folder; uploader + admin read.
-- Documents are immutable once submitted (no update policy); re-submission
-- creates a new object.
-- ---------------------------------------------------------------------------
create policy "verification_docs_insert" on storage.objects
  for insert with check (
    bucket_id = 'verification-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "verification_docs_read" on storage.objects
  for select using (
    bucket_id = 'verification-documents'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- avatars: world-readable, user-managed within own folder
-- ---------------------------------------------------------------------------
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_write" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
