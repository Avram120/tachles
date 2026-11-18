-- Client email + phone (shown in the client list; email is also how "משוך מהשאלון" finds the intake).
alter table public.businesses add column if not exists email text not null default '';
alter table public.businesses add column if not exists phone text not null default '';

drop function if exists public.create_client(text, text);
create or replace function public.create_client(p_name text, p_business text, p_email text default '', p_phone text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare b uuid; e text := lower(btrim(coalesce(p_email, ''))); ph text := btrim(coalesce(p_phone, ''));
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'name required'; end if;
  insert into public.businesses(name, business, email, phone)
  values (btrim(p_name), coalesce(btrim(p_business), ''), e, ph) returning id into b;
  insert into public.diagnoses(business_id, prefill) values (b, jsonb_build_object(
    'client', jsonb_build_object('name', btrim(p_name), 'business', coalesce(btrim(p_business), ''), 'email', e, 'phone', ph,
                                 'folder', '', 'date', to_char(now() at time zone 'Asia/Jerusalem', 'DD.MM.YYYY')),
    'domains', '[]'::jsonb,
    'prefill', jsonb_build_object('blockers', '[]'::jsonb, 'resources', '[]'::jsonb)));
  return b;
end $$;
revoke execute on function public.create_client(text, text, text, text) from public, anon;
grant execute on function public.create_client(text, text, text, text) to authenticated;
