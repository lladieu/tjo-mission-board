-- Mission Board v13: Command Staff+ application deletion
-- Run this ONCE in Supabase SQL Editor before deploying the matching site files.

-- Command Staff, Super Admins, and the Owner may permanently delete mission applications.
drop policy if exists applications_delete_command on public.mission_applications;
create policy applications_delete_command
on public.mission_applications
for delete
to authenticated
using (public.is_command_staff());
