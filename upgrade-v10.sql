-- Jedi Mission Board v10
-- Adds site-wide Service Records leaderboard and automatic announcement notifications.
-- Run ONCE in Supabase SQL Editor after v9.

-- Authenticated personnel can see only the non-sensitive fields needed by the service leaderboard.
-- SECURITY DEFINER prevents exposing email/auth data and bypasses profile RLS only inside this function.
create or replace function public.get_service_leaderboard()
returns table (
  user_id uuid,
  character_name text,
  rank text,
  pathway text,
  class text,
  mission_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.character_name,
    p.rank,
    p.pathway,
    p.class,
    count(ma.id) filter (where ma.status = 'approved')::bigint as mission_count
  from public.profiles p
  left join public.mission_applications ma on ma.user_id = p.id
  where p.character_name is not null and btrim(p.character_name) <> ''
  group by p.id, p.character_name, p.rank, p.pathway, p.class
  order by mission_count desc, lower(p.character_name) asc;
$$;

revoke all on function public.get_service_leaderboard() from public;
grant execute on function public.get_service_leaderboard() to authenticated;

-- Every new Command announcement creates an unread notification for every personnel profile.
create or replace function public.notify_all_on_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(user_id, title, body, read)
  select p.id,
         'COMMAND BULLETIN: ' || new.title,
         new.body,
         false
  from public.profiles p;
  return new;
end;
$$;

drop trigger if exists announcement_notify_all_trigger on public.announcements;
create trigger announcement_notify_all_trigger
after insert on public.announcements
for each row execute function public.notify_all_on_announcement();
