-- Avraham adds a client himself from the client list.
create or replace function public.create_client(p_name text, p_business text) returns uuid
language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'name required'; end if;
  insert into public.businesses(name, business) values (btrim(p_name), coalesce(btrim(p_business), ''))
  returning id into b;
  insert into public.diagnoses(business_id, prefill) values (b, jsonb_build_object(
    'client', jsonb_build_object('name', btrim(p_name), 'business', coalesce(btrim(p_business), ''),
                                 'folder', '', 'date', to_char(now() at time zone 'Asia/Jerusalem', 'DD.MM.YYYY')),
    'domains', '[]'::jsonb,
    'prefill', jsonb_build_object('blockers', '[]'::jsonb, 'resources', '[]'::jsonb)));
  return b;
end $$;
revoke execute on function public.create_client(text, text) from public, anon;
grant execute on function public.create_client(text, text) to authenticated;
