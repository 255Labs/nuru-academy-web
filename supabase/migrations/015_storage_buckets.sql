-- ============================================================================
-- Migration 015: Storage buckets — lesson-videos (private), lesson-images (public), certificates (public)
-- Dependencies: 001_core_auth
-- ============================================================================
-- ============================================================================
-- STORAGE BUCKETS (run once — safe to re-run)
-- ============================================================================

-- Private video bucket — only accessible via signed URLs generated server-side
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-videos',
  'lesson-videos',
  false,
  1073741824,  -- 1 GB
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public images bucket — lesson cover images, accessible without auth
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-images',
  'lesson-images',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public certificates bucket — generated certificate images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificates',
  'certificates',
  true,
  5242880,   -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS policies
drop policy if exists "Admin uploads videos" on storage.objects;
create policy "Admin uploads videos" on storage.objects
  for insert with check (
    bucket_id = 'lesson-videos'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Admin reads videos" on storage.objects;
create policy "Admin reads videos" on storage.objects
  for select using (
    bucket_id = 'lesson-videos'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Enrolled learners read videos" on storage.objects;
create policy "Enrolled learners read videos" on storage.objects
  for select using (
    bucket_id = 'lesson-videos'
    and exists (
      select 1 from public.enrollments e
      join public.modules m on m.track_id = e.track_id
      where e.user_id = auth.uid()
    )
  );

drop policy if exists "Anyone reads lesson images" on storage.objects;
create policy "Anyone reads lesson images" on storage.objects
  for select using (bucket_id = 'lesson-images');

drop policy if exists "Admin uploads lesson images" on storage.objects;
create policy "Admin uploads lesson images" on storage.objects
  for insert with check (
    bucket_id = 'lesson-images'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Admin deletes lesson images" on storage.objects;
create policy "Admin deletes lesson images" on storage.objects
  for delete using (
    bucket_id = 'lesson-images'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Anyone reads certificates" on storage.objects;
create policy "Anyone reads certificates" on storage.objects
  for select using (bucket_id = 'certificates');

drop policy if exists "Service role writes certificates" on storage.objects;
create policy "Service role writes certificates" on storage.objects
  for insert with check (bucket_id = 'certificates');


