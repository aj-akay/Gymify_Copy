insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trainer-avatars',
  'trainer-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone can view trainer profile photos"
  on storage.objects for select
  using (bucket_id = 'trainer-avatars');

create policy "Trainers can upload their own profile photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trainer-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Trainers can update their own profile photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'trainer-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'trainer-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
