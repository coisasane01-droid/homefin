-- HomeFin: estruturas para autenticacao familiar.
-- Esta migracao NAO altera nem apaga os dados financeiros existentes.
-- Revisar antes de executar no Supabase SQL Editor.

create table if not exists public.homefin_family_credentials (
  family_id text primary key,
  pin_salt text not null,
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homefin_family_credentials_family_id_format
    check (family_id ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  constraint homefin_family_credentials_pin_salt_format
    check (pin_salt ~ '^[a-f0-9]{32}$'),
  constraint homefin_family_credentials_pin_hash_format
    check (pin_hash ~ '^[a-f0-9]{128}$')
);

create table if not exists public.homefin_auth_attempts (
  id bigint generated always as identity primary key,
  family_id text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists homefin_auth_attempts_family_time_idx
  on public.homefin_auth_attempts (family_id, attempted_at desc);

-- Impede acesso direto pelas chaves publicas do navegador.
alter table public.homefin_family_credentials enable row level security;
alter table public.homefin_auth_attempts enable row level security;

revoke all on public.homefin_family_credentials from anon, authenticated;
revoke all on public.homefin_auth_attempts from anon, authenticated;

grant select, insert, update, delete
  on public.homefin_family_credentials to service_role;
grant select, insert, update, delete
  on public.homefin_auth_attempts to service_role;
grant usage, select
  on sequence public.homefin_auth_attempts_id_seq to service_role;

-- A funcao registra falhas e permite no maximo 10 tentativas
-- nos ultimos 15 minutos por familia.
create or replace function public.homefin_register_auth_failure(
  p_family_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  if p_family_id is null
     or p_family_id !~ '^[a-z0-9][a-z0-9-]{0,99}$' then
    return false;
  end if;

  -- Serializa a contagem por familia para evitar corridas.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_family_id, 0)
  );

  select count(*)::integer
    into v_count
    from public.homefin_auth_attempts
   where family_id = p_family_id
     and attempted_at >= now() - interval '15 minutes';

  if v_count >= 10 then
    return false;
  end if;

  insert into public.homefin_auth_attempts (family_id, attempted_at)
  values (p_family_id, now());

  return true;
end;
$function$;

revoke all on function public.homefin_register_auth_failure(text)
  from public, anon, authenticated;
grant execute on function public.homefin_register_auth_failure(text)
  to service_role;

