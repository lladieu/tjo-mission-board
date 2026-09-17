-- Mission Board v12: Owner personnel moderation (kick / ban / restore)
-- Run this ONCE in Supabase SQL Editor before uploading the matching app.js.

alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active','kicked','banned'));

-- Only the Owner may change another account's access status.
create or replace function public.prevent_account_status_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.account_status is distinct from old.account_status and not public.is_owner() then
    raise exception 'Only the Owner may change personnel access status';
  end if;
  return new;
end; $$;

drop trigger if exists prevent_account_status_change_trigger on public.profiles;
create trigger prevent_account_status_change_trigger
before update on public.profiles
for each row execute procedure public.prevent_account_status_change();
