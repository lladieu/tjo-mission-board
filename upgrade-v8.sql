-- Run this ONCE in Supabase SQL Editor when upgrading an existing Mission Board to v8.
create table if not exists public.personnel_options (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('rank','pathway','class')),
  value text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(category,value)
);
insert into public.personnel_options(category,value,sort_order) values
('rank','Padawan',0),('rank','Knight',1),('rank','Master',2),
('pathway','Guardian',0),('pathway','Consular',1),('pathway','Sentinel',2),('pathway','None',3),
('class','Weapon Master',0),('class','Battlemaster',1),('class','Instructor',2),('class','Investigator',3),('class','Shadow',4),('class','Lorekeeper',5),('class','Sage',6),('class','Minor Council',7),('class','High Council',8),('class','Master of the Order',9),('class','Grandmaster of the Order',10),('class','None',11)
on conflict (category,value) do nothing;
alter table public.personnel_options enable row level security;
drop policy if exists personnel_options_select_authenticated on public.personnel_options;
create policy personnel_options_select_authenticated on public.personnel_options for select to authenticated using (true);
drop policy if exists personnel_options_insert_owner on public.personnel_options;
create policy personnel_options_insert_owner on public.personnel_options for insert to authenticated with check (public.is_owner());
drop policy if exists personnel_options_update_owner on public.personnel_options;
create policy personnel_options_update_owner on public.personnel_options for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists personnel_options_delete_owner on public.personnel_options;
create policy personnel_options_delete_owner on public.personnel_options for delete to authenticated using (public.is_owner());
