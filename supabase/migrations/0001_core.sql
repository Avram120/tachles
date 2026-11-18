-- Tachles core: admins, businesses, members, diagnoses + RLS + versioned save.

create table if not exists public.admins (
  email text primary key
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business text not null default '',
  folder text not null default '',
  stage text not null default 'm1' check (stage in ('m1','m2','owner_work','published','view_only')),
  track text not null default 'diagnosis' check (track in ('diagnosis','coaching')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  is_primary boolean not null default false,
  primary key (business_id, email)
);

create table if not exists public.diagnoses (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  prefill jsonb not null,
  state jsonb,
  version int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.admins enable row level security;
alter table public.businesses enable row level security;
alter table public.members enable row level security;
alter table public.diagnoses enable row level security;

revoke all on public.admins from anon, authenticated;

create or replace function public.jwt_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt()->>'email', '')) $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = public.jwt_email())
$$;

create or replace function public.is_member(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.business_id = b and lower(m.email) = public.jwt_email())
$$;

drop policy if exists admin_all on public.businesses;
create policy admin_all on public.businesses for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists member_read on public.businesses;
create policy member_read on public.businesses for select to authenticated using (public.is_member(id));

drop policy if exists admin_all on public.members;
create policy admin_all on public.members for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists member_read_own on public.members;
create policy member_read_own on public.members for select to authenticated using (lower(email) = public.jwt_email());

drop policy if exists admin_all on public.diagnoses;
create policy admin_all on public.diagnoses for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.save_diagnosis(p_business uuid, p_state jsonb, p_version int) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.diagnoses
     set state = p_state, version = version + 1, updated_at = now()
   where business_id = p_business and version = p_version
  returning version into v;
  if v is null then
    raise exception 'conflict';
  end if;
  return v;
end $$;

revoke execute on function public.save_diagnosis(uuid, jsonb, int) from public, anon;
grant execute on function public.save_diagnosis(uuid, jsonb, int) to authenticated;
grant execute on function public.is_admin() to authenticated;
