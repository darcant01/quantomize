-- Logo support: create a public storage bucket for store logos
-- Run in Supabase → SQL Editor (or create the bucket via Storage UI)

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Allow public read + service-role writes (API uses service key)
drop policy if exists "public read logos" on storage.objects;
create policy "public read logos" on storage.objects
  for select using (bucket_id = 'logos');

select 'Logo bucket ready!' as status;
