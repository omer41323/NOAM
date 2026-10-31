-- One private workspace, explicitly assigned by an administrator.
-- Personal content is never shipped in the static frontend.
create table public.workspace_members (
  workspace_id uuid not null,
  email text not null check (email = lower(email)),
  primary key (workspace_id, email)
);
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) < 5242880),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.workspace_members add constraint workspace_members_workspace_fk foreign key (workspace_id) references public.workspaces(id);
create table public.child_files (
  workspace_id uuid not null references public.workspaces(id),
  id text not null check (id ~ '^[a-zA-Z0-9_@.:-]+$'),
  child text not null check (child ~ '^[1-9]$'),
  name text not null check (length(name) between 1 and 500),
  size bigint not null check (size between 0 and 20971520),
  type text not null default '',
  storage_path text not null,
  added timestamptz not null default now(),
  note_id text,
  primary key (workspace_id, id),
  check (storage_path like workspace_id::text || '/%')
);
create index child_files_child on public.child_files(workspace_id, child);
alter table public.workspace_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.child_files enable row level security;
revoke all on public.workspace_members, public.workspaces, public.child_files from anon;
grant select on public.workspace_members to authenticated;
grant select, update on public.workspaces to authenticated;
grant select, insert, update, delete on public.child_files to authenticated;
create policy member_self on public.workspace_members for select to authenticated
  using (email = lower((select auth.jwt()->>'email')) and (select auth.uid()) is not null);
create policy workspace_read on public.workspaces for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = id));
create policy workspace_write on public.workspaces for update to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = id))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = id));
create policy files_read on public.child_files for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = child_files.workspace_id));
create policy files_insert on public.child_files for insert to authenticated
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = child_files.workspace_id));
create policy files_update on public.child_files for update to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = child_files.workspace_id))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = child_files.workspace_id));
create policy files_delete on public.child_files for delete to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = child_files.workspace_id));
create function public.check_workspace_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.id <> old.id or new.revision <> old.revision + 1 then
    raise exception 'Invalid workspace revision';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.check_workspace_revision() from public;
create trigger workspace_revision before update on public.workspaces
  for each row execute function public.check_workspace_revision();
insert into storage.buckets (id, name, public, file_size_limit)
values ('child-files', 'child-files', false, 20971520);
create policy objects_read on storage.objects for select to authenticated
  using (bucket_id = 'child-files' and exists (select 1 from public.workspace_members m where m.workspace_id::text = (storage.foldername(name))[1]));
create policy objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'child-files' and exists (select 1 from public.workspace_members m where m.workspace_id::text = (storage.foldername(name))[1]));
create policy objects_update on storage.objects for update to authenticated
  using (bucket_id = 'child-files' and exists (select 1 from public.workspace_members m where m.workspace_id::text = (storage.foldername(name))[1]))
  with check (bucket_id = 'child-files' and exists (select 1 from public.workspace_members m where m.workspace_id::text = (storage.foldername(name))[1]));
create policy objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'child-files' and exists (select 1 from public.workspace_members m where m.workspace_id::text = (storage.foldername(name))[1]));

