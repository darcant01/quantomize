-- ============================================================
--  Make yourself a Developer / Superadmin
--  Run AFTER signing up through the app.
--  Replace the email with your own.
-- ============================================================

alter table profiles add column if not exists superadmin boolean not null default false;

update profiles set superadmin = true
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');

select p.full_name, p.role, p.superadmin, s.name as store
from profiles p left join stores s on s.id = p.store_id
where p.superadmin = true;
