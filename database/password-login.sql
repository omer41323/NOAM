-- Additive setup. Account mappings are seeded privately by an administrator.
create table public.login_accounts (
  username text primary key check (username ~ '^[a-z0-9_]{3,30}$'),
  email text not null unique,
  workspace_id uuid not null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  is_owner boolean not null default false,
  foreign key (workspace_id,email) references public.workspace_members(workspace_id,email) on delete cascade
);
alter table public.login_accounts enable row level security;
revoke all on public.login_accounts from public, anon, authenticated;
grant select, update on public.login_accounts to service_role;

create table public.login_attempts (
  key text primary key,
  window_start timestamptz not null,
  attempts integer not null
);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from public, anon, authenticated;
grant select, insert, update on public.login_attempts to service_role;

-- Atomic across concurrent Edge workers. Only the server can consume attempts.
create function public.consume_login_attempt(p_key text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  insert into public.login_attempts as a (key,window_start,attempts)
  values (p_key,now(),1)
  on conflict (key) do update set
    attempts = case when a.window_start < now()-interval '10 minutes' then 1 else a.attempts+1 end,
    window_start = case when a.window_start < now()-interval '10 minutes' then now() else a.window_start end
  returning attempts into n;
  return n <= 10;
end;
$$;
revoke all on function public.consume_login_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_login_attempt(text) to service_role;
