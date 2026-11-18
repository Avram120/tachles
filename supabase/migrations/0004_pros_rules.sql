-- Admin-only: professionals list and master rules list (never sent to client devices).
create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  field text not null default '',
  phone text not null default '',
  email text not null default '',
  note text not null default '',
  created_at timestamptz default now()
);
create table if not exists public.rules (
  id int primary key,
  grp text not null,
  title text not null,
  body text not null default ''
);
alter table public.professionals enable row level security;
alter table public.rules enable row level security;
drop policy if exists admin_all on public.professionals;
create policy admin_all on public.professionals for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.rules;
create policy admin_all on public.rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.professionals from anon;
revoke all on public.rules from anon;
