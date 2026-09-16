-- Jedi Mission Board v9: server-side personnel profanity/slur filter.
-- Run this ONCE in Supabase SQL Editor after v8.

create table if not exists public.blocked_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  created_at timestamptz not null default now(),
  constraint blocked_terms_min_length check (char_length(regexp_replace(term, '[^[:alnum:]]', '', 'g')) >= 4)
);

-- Seed a baseline list. The Owner can add/remove terms later in Administration -> Name Filter.
insert into public.blocked_terms(term) values
  ('nigger'), ('nigga'), ('faggot'), ('retard'), ('cunt'), ('bitch'),
  ('fuck'), ('whore'), ('pussy'), ('dickhead'), ('cock'), ('porn')
on conflict (term) do nothing;

alter table public.blocked_terms enable row level security;

drop policy if exists blocked_terms_select_owner on public.blocked_terms;
create policy blocked_terms_select_owner on public.blocked_terms
  for select to authenticated using (public.is_owner());

drop policy if exists blocked_terms_insert_owner on public.blocked_terms;
create policy blocked_terms_insert_owner on public.blocked_terms
  for insert to authenticated with check (public.is_owner());

drop policy if exists blocked_terms_update_owner on public.blocked_terms;
create policy blocked_terms_update_owner on public.blocked_terms
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists blocked_terms_delete_owner on public.blocked_terms;
create policy blocked_terms_delete_owner on public.blocked_terms
  for delete to authenticated using (public.is_owner());

-- Normalize common attempts to evade a filter: punctuation/spaces, repeated letters,
-- and common substitutions such as 1/i, 3/e, 4/a, 5/s, 7/t, 0/o, @/a, $/s, !/i.
create or replace function public.normalize_moderation_text(input_text text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(coalesce(input_text, ''));
begin
  v := replace(v, '0', 'o');
  v := replace(v, '1', 'i');
  v := replace(v, '3', 'e');
  v := replace(v, '4', 'a');
  v := replace(v, '5', 's');
  v := replace(v, '7', 't');
  v := replace(v, '@', 'a');
  v := replace(v, '$', 's');
  v := replace(v, '!', 'i');
  v := replace(v, '|', 'i');
  v := regexp_replace(v, '[^a-z0-9]', '', 'g');
  -- Collapse 3+ repeated characters to 2. This catches exaggerated evasions
  -- while preserving ordinary doubled letters in names/terms.
  v := regexp_replace(v, '(.)\1{2,}', '\1\1', 'g');
  return v;
end;
$$;

create or replace function public.personnel_text_is_allowed(input_text text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.blocked_terms bt
    where position(public.normalize_moderation_text(bt.term)
                   in public.normalize_moderation_text(input_text)) > 0
  );
$$;

create or replace function public.enforce_personnel_name_filter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.personnel_text_is_allowed(new.character_name)
     or not public.personnel_text_is_allowed(new.roblox_user)
     or not public.personnel_text_is_allowed(new.discord_user) then
    raise exception 'PERSONNEL RECORD REJECTED: One or more entries violate Jedi Order naming standards. Revise the record and resubmit.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_personnel_name_filter_trigger on public.profiles;
create trigger enforce_personnel_name_filter_trigger
before insert or update of character_name, roblox_user, discord_user
on public.profiles
for each row execute function public.enforce_personnel_name_filter();
