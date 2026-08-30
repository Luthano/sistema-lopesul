-- Promove Michael Hoppen a master e inclui o e-mail no cadastro automático.

alter table public.profiles disable trigger protect_profile_fields;

update public.profiles
set
  role = 'master',
  status = 'approved',
  approved_at = coalesce(approved_at, now())
where lower(email) = 'michael@lopesul.com';

alter table public.profiles enable trigger protect_profile_fields;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  master_emails text[] := array['luthanogomes@gmail.com', 'michael@lopesul.com'];
  is_master_email boolean;
begin
  is_master_email := lower(coalesce(new.email, '')) = any (master_emails);
  insert into public.profiles (id, email, status, role, approved_at)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    case when is_master_email then 'approved' else 'pending' end,
    case when is_master_email then 'master' else 'user' end,
    case when is_master_email then now() else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
