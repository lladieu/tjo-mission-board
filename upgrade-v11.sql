-- Mission Board v11
-- Announcement ownership: authors may edit/delete their own bulletins; Owner may manage all.

drop policy if exists announcements_update_command on public.announcements;
drop policy if exists announcements_delete_command on public.announcements;
drop policy if exists announcements_update_author_or_owner on public.announcements;
drop policy if exists announcements_delete_author_or_owner on public.announcements;

create policy announcements_update_author_or_owner
on public.announcements
for update to authenticated
using (created_by = auth.uid() or public.is_owner())
with check (created_by = auth.uid() or public.is_owner());

create policy announcements_delete_author_or_owner
on public.announcements
for delete to authenticated
using (created_by = auth.uid() or public.is_owner());
