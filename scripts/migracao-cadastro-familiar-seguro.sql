-- HomeFin: cadastro familiar atomico.
-- Preserva os dados financeiros e as configuracoes existentes.
-- Executar no SQL Editor do Supabase antes de ativar o novo fluxo.

create or replace function public.homefin_create_family_with_credentials(
  p_family jsonb,
  p_pin_salt text,
  p_pin_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_family_id text;
  v_data jsonb;
  v_families jsonb;
begin
  v_family_id := p_family->>'id';

  if v_family_id is null
     or v_family_id !~ '^[a-z0-9][a-z0-9-]{0,99}$' then
    raise exception 'Identificador de familia invalido.';
  end if;

  if coalesce(trim(p_family->>'name'), '') = '' then
    raise exception 'Nome da familia obrigatorio.';
  end if;

  if p_pin_salt is null or p_pin_salt !~ '^[a-f0-9]{32}$'
     or p_pin_hash is null or p_pin_hash !~ '^[a-f0-9]{128}$' then
    raise exception 'Credencial invalida.';
  end if;

  select data into v_data
    from public.homefin_saas
   where id = 'global'
   for update;

  if not found then
    raise exception 'Registro global do HomeFin nao encontrado.';
  end if;

  v_families := case
    when jsonb_typeof(v_data->'families') = 'array'
      then v_data->'families'
    else '[]'::jsonb
  end;

  if exists (
    select 1
      from jsonb_array_elements(v_families) as f(value)
     where f.value->>'id' = v_family_id
  ) or exists (
    select 1
      from public.homefin_family_credentials c
     where c.family_id = v_family_id
  ) then
    raise exception 'Este identificador de familia ja existe.';
  end if;

  update public.homefin_saas
     set data = jsonb_set(
       coalesce(v_data, '{}'::jsonb),
       '{families}',
       v_families || jsonb_build_array(p_family),
       true
     ),
         updated_at = now()
   where id = 'global';

  insert into public.homefin_family_credentials (
    family_id, pin_salt, pin_hash
  ) values (
    v_family_id, p_pin_salt, p_pin_hash
  );

  return jsonb_build_object('success', true, 'familyId', v_family_id);
end;
$function$;

revoke all on function public.homefin_create_family_with_credentials(
  jsonb, text, text
) from public, anon, authenticated;

grant execute on function public.homefin_create_family_with_credentials(
  jsonb, text, text
) to service_role;
