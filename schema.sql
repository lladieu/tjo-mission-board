-- JEDI ORDER MISSION TERMINAL
-- Supabase/Postgres schema for the live version.
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('player','command_staff','super_admin','owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.mission_status as enum ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.application_status as enum ('pending','approved','declined','withdrawn','removed');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_user text,
  roblox_user text,
  character_name text,
  rank text,
  pathway text,
  class text,
  role public.user_role not null default 'player',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  main_category text not null check (main_category in ('WARFRONT','JEDI')),
  type text not null,
  threat_level text not null check (threat_level in ('LOW','MODERATE','HIGH','CRITICAL')),
  required_personnel integer not null check (required_personnel > 0),
  location text not null,
  jedi_lead text not null,
  date timestamptz not null,
  briefing text not null,
  status public.mission_status not null default 'OPEN',
  result_summary text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mission_applications (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.application_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(mission_id,user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key default 1 check (id=1),
  terminal_name text not null default 'MISSION TERMINAL',
  command_name text not null default 'JEDI ORDER // OPERATIONS COMMAND',
  system_status text not null default 'SECURE CHANNEL',
  footer_text text not null default 'SECURE • AUTHORIZED PERSONNEL ONLY',
  updated_at timestamptz not null default now()
);

insert into public.site_settings(id) values (1) on conflict (id) do nothing;

-- Admin-managed mission taxonomy and planetary roster.
create table if not exists public.mission_types (
  id uuid primary key default gen_random_uuid(),
  main_category text not null check (main_category in ('WARFRONT','JEDI')),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(main_category,name)
);

create table if not exists public.planets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.missions add column if not exists planet text;

insert into public.mission_types(main_category,name,sort_order) values
('WARFRONT','Assault',0),('WARFRONT','Defense',1),('WARFRONT','Recon',2),('WARFRONT','Sabotage',3),('WARFRONT','Intelligence',4),('WARFRONT','Supply',5),('WARFRONT','Aid',6),('WARFRONT','Escort',7),('WARFRONT','Search & Rescue',8),('WARFRONT','Elimination',9),('WARFRONT','Special Operations',10),
('JEDI','Artifact Recovery',0),('JEDI','Diplomacy',1),('JEDI','Research',2),('JEDI','Recon',3),('JEDI','Temple Operations',4),('JEDI','Support',5),('JEDI','Investigation',6),('JEDI','Exploration',7),('JEDI','Judicial',8),('JEDI','Special Operations',9)
on conflict (main_category,name) do nothing;

insert into public.planets(name,sort_order) values
('Alderaan',0),('Balmorra',1),('Corellia',2),('Coruscant',3),('Dromund Kaas',4),('Korriban',5),('Nar Shaddaa',6),('Ord Mantell',7),('Taris',8),('Tython',9)
on conflict (name) do nothing;

create or replace function public.is_command_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role in ('command_staff','super_admin','owner')); $$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'super_admin'); $$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'owner'); $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, discord_user)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'preferred_username', new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute procedure public.touch_updated_at();
drop trigger if exists missions_touch on public.missions;
create trigger missions_touch before update on public.missions for each row execute procedure public.touch_updated_at();
drop trigger if exists applications_touch on public.mission_applications;
create trigger applications_touch before update on public.mission_applications for each row execute procedure public.touch_updated_at();

-- Notification when Command Staff changes an application decision.
create or replace function public.notify_application_decision()
returns trigger language plpgsql security definer set search_path = public
as $$
declare mission_name text;
begin
  if new.status <> old.status and new.status in ('approved','declined','removed') then
    select name into mission_name from public.missions where id = new.mission_id;
    insert into public.notifications(user_id,title,body)
    values (
      new.user_id,
      case new.status when 'approved' then 'ASSIGNMENT APPROVED' when 'declined' then 'REQUEST DECLINED' else 'ASSIGNMENT REMOVED' end,
      case new.status when 'approved' then 'Command has approved your assignment request for ' || mission_name || '.'
        when 'declined' then 'Command has declined your assignment request for ' || mission_name || '.'
        else 'Command has removed your assignment from ' || mission_name || '.' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists application_decision_notification on public.mission_applications;
create trigger application_decision_notification
after update on public.mission_applications
for each row execute procedure public.notify_application_decision();

-- Notification when Command Staff posts a mission.
create or replace function public.notify_new_mission()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications(user_id,title,body)
  select id, 'NEW OPERATION POSTED', 'A new ' || new.main_category || ' operation has been posted: ' || new.name || '.'
  from public.profiles where id <> new.created_by;
  return new;
end;
$$;

drop trigger if exists mission_posted_notification on public.missions;
create trigger mission_posted_notification
after insert on public.missions
for each row execute procedure public.notify_new_mission();

create or replace function public.notify_mission_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (new.date is distinct from old.date or new.status is distinct from old.status or new.location is distinct from old.location) then
    insert into public.notifications(user_id,title,body)
    select distinct ma.user_id, 'OPERATION UPDATED', new.name || ' has received an operational update. Review the mission briefing for current details.'
    from public.mission_applications ma
    where ma.mission_id=new.id and ma.status='approved';
  end if;
  return new;
end;
$$;

drop trigger if exists mission_update_notification on public.missions;
create trigger mission_update_notification
after update on public.missions
for each row execute procedure public.notify_mission_update();



-- Prevent Command Staff from approving a mission beyond its personnel limit.
create or replace function public.enforce_mission_capacity()
returns trigger language plpgsql security definer set search_path = public
as $$
declare cap integer; current_count integer;
begin
  if new.status='approved' and old.status <> 'approved' then
    select required_personnel into cap from public.missions where id=new.mission_id;
    select count(*) into current_count from public.mission_applications where mission_id=new.mission_id and status='approved' and id<>new.id;
    if current_count >= cap then raise exception 'Mission personnel limit reached'; end if;
  end if;
  return new;
end; $$;

drop trigger if exists mission_capacity_trigger on public.mission_applications;
create trigger mission_capacity_trigger before update on public.mission_applications for each row execute procedure public.enforce_mission_capacity();


create or replace function public.notify_new_announcement()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications(user_id,title,body)
  select id, 'COMMAND BULLETIN', new.title from public.profiles where id <> new.created_by;
  return new;
end;
$$;

drop trigger if exists announcement_posted_notification on public.announcements;
create trigger announcement_posted_notification
after insert on public.announcements
for each row execute procedure public.notify_new_announcement();

-- Row Level Security.
alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.mission_applications enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.site_settings enable row level security;
alter table public.mission_types enable row level security;
alter table public.planets enable row level security;

-- Profiles: authenticated personnel can see the roster; users can edit their own identity fields.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
drop policy if exists profiles_update_super on public.profiles;
create policy profiles_update_super on public.profiles for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- Command Staff may maintain personnel records, but only the Owner may change account roles.
create or replace function public.prevent_role_escalation()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  if new.role is distinct from old.role and not public.is_owner() then
    raise exception 'Only the Owner may change personnel roles';
  end if;
  return new;
end; $$;

drop trigger if exists prevent_role_escalation_trigger on public.profiles;
create trigger prevent_role_escalation_trigger before update on public.profiles for each row execute procedure public.prevent_role_escalation();

drop policy if exists profiles_update_command on public.profiles;
create policy profiles_update_command on public.profiles for update to authenticated using (public.is_command_staff()) with check (public.is_command_staff());

-- Missions: everyone authenticated can read; Command Staff can create/edit/delete.
drop policy if exists missions_select_authenticated on public.missions;
create policy missions_select_authenticated on public.missions for select to authenticated using (true);
drop policy if exists missions_insert_command on public.missions;
create policy missions_insert_command on public.missions for insert to authenticated with check (public.is_command_staff());
drop policy if exists missions_update_command on public.missions;
create policy missions_update_command on public.missions for update to authenticated using (public.is_command_staff()) with check (public.is_command_staff());
drop policy if exists missions_delete_command on public.missions;
create policy missions_delete_command on public.missions for delete to authenticated using (public.is_command_staff());

-- Applications: everyone can read rosters; players may create their own pending request and withdraw it; Command Staff can manage all decisions.
drop policy if exists applications_select_authenticated on public.mission_applications;
create policy applications_select_authenticated on public.mission_applications for select to authenticated using (true);
drop policy if exists applications_insert_self on public.mission_applications;
create policy applications_insert_self on public.mission_applications for insert to authenticated with check (user_id=auth.uid() and status='pending');
drop policy if exists applications_update_self on public.mission_applications;
create policy applications_update_self on public.mission_applications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and status='withdrawn');
drop policy if exists applications_update_command on public.mission_applications;
create policy applications_update_command on public.mission_applications for update to authenticated using (public.is_command_staff()) with check (public.is_command_staff());

-- Notifications: users only see their own; users can mark their own as read.
drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications for select to authenticated using (user_id=auth.uid());
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Announcements: all authenticated users read; Command Staff manage.
drop policy if exists announcements_select_authenticated on public.announcements;
create policy announcements_select_authenticated on public.announcements for select to authenticated using (true);
drop policy if exists announcements_insert_command on public.announcements;
create policy announcements_insert_command on public.announcements for insert to authenticated with check (public.is_command_staff());
drop policy if exists announcements_update_command on public.announcements;
create policy announcements_update_command on public.announcements for update to authenticated using (public.is_command_staff()) with check (public.is_command_staff());
drop policy if exists announcements_delete_command on public.announcements;
create policy announcements_delete_command on public.announcements for delete to authenticated using (public.is_command_staff());

-- Site settings: everyone authenticated can read; Command Staff can update.
drop policy if exists site_settings_select_authenticated on public.site_settings;
create policy site_settings_select_authenticated on public.site_settings for select to authenticated using (true);
drop policy if exists site_settings_update_command on public.site_settings;
create policy site_settings_update_command on public.site_settings for update to authenticated using (public.is_command_staff()) with check (public.is_command_staff());


-- Mission taxonomy and planetary roster: authenticated users can read; Command Staff can maintain.
drop policy if exists mission_types_select_authenticated on public.mission_types;
create policy mission_types_select_authenticated on public.mission_types for select to authenticated using (true);
drop policy if exists mission_types_insert_command on public.mission_types;
create policy mission_types_insert_command on public.mission_types for insert to authenticated with check (public.is_command_staff());
drop policy if exists mission_types_update_command on public.mission_types;
create policy mission_types_update_command on public.mission_types for update to authenticated using (public.is_command_staff()) with check (public.is_command_staff());
drop policy if exists mission_types_delete_command on public.mission_types;
create policy mission_types_delete_command on public.mission_types for delete to authenticated using (public.is_command_staff());

drop policy if exists planets_select_authenticated on public.planets;
create policy planets_select_authenticated on public.planets for select to authenticated using (true);
drop policy if exists planets_insert_command on public.planets;
create policy planets_insert_command on public.planets for insert to authenticated with check (public.is_command_staff());
drop policy if exists planets_update_command on public.planets;
create policy planets_update_command on public.planets for update to authenticated using (public.is_command_staff()) with check (public.is_command_staff());
drop policy if exists planets_delete_command on public.planets;
create policy planets_delete_command on public.planets for delete to authenticated using (public.is_command_staff());

-- Helpful indexes.
create index if not exists missions_status_idx on public.missions(status);
create index if not exists missions_date_idx on public.missions(date);
create index if not exists applications_mission_idx on public.mission_applications(mission_id,status);
create index if not exists applications_user_idx on public.mission_applications(user_id,status);
create index if not exists notifications_user_idx on public.notifications(user_id,read,created_at desc);

-- FIRST ADMIN SETUP:
-- 1) Sign into the website once with your Discord account.
-- 2) Find your row in public.profiles.
-- 3) Run this command once, replacing the UUID:
-- update public.profiles set role='super_admin' where id='YOUR-AUTH-USER-UUID';
