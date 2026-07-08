-- Add granular permissions column (run once in Supabase SQL Editor)
alter table profiles add column if not exists permissions jsonb default null;
select 'Permissions column added!' as status;
