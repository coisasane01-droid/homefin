-- ============================================================================
-- HOMEFIN — MÓDULO DE ESTOQUE MULTI-FAMÍLIA (COMPARTILHADO & PRIVADO)
-- Execute este script no SQL Editor do seu projeto Supabase (HOMEFIN).
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Tabela principal de estoques (cada usuário/família pode ter vários)
create table if not exists public.homefin_estoques (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('privado', 'compartilhado')),
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_family_id text not null,
  owner_family_name text not null default 'Minha Família',
  codigo_compartilhamento text unique,
  created_at timestamptz not null default now()
);

-- 2. Membros / Famílias vinculadas ao estoque
-- Quando tipo = 'compartilhado', ambas as famílias ficam registradas aqui
-- e enxergam exatamente o mesmo estoque em tempo real.
create table if not exists public.homefin_estoque_membros (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid not null references public.homefin_estoques(id) on delete cascade,
  family_id text not null,
  family_name text not null,
  user_id uuid references auth.users(id) on delete set null,
  role text not null default 'editor' check (role in ('dono', 'editor')),
  joined_at timestamptz not null default now(),
  unique (estoque_id, family_id)
);

-- 3. Produtos de cada estoque
create table if not exists public.homefin_estoque_produtos (
  id text primary key,
  estoque_id uuid not null references public.homefin_estoques(id) on delete cascade,
  codigo_interno text not null,
  codigo_barras text not null default '',
  descricao text not null,
  medida text not null default '',
  unidade text not null default 'UN',
  marca_refer text not null default '',
  estoque_atual numeric not null default 0,
  preco_varejo numeric not null default 0,
  preco_atacado numeric not null default 0,
  valor_prom numeric not null default 0,
  ncm text not null default '00000000',
  peso_bruto numeric not null default 0,
  peso_liquido numeric not null default 0,
  observacao text not null default '',
  foto_url text not null default '',
  favorito boolean not null default false,
  venda_media_mensal numeric not null default 0,
  estoque_minimo numeric not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_hf_produtos_estoque on public.homefin_estoque_produtos(estoque_id);

-- 4. Histórico de movimentações (entradas e baixas)
create table if not exists public.homefin_estoque_movimentacoes (
  id text primary key,
  estoque_id uuid not null references public.homefin_estoques(id) on delete cascade,
  timestamp_label text not null,
  product_id text not null,
  codigo_interno text not null,
  descricao text not null,
  tipo text not null check (tipo in ('baixa', 'entrada')),
  quantidade numeric not null,
  estoque_anterior numeric not null,
  estoque_novo numeric not null,
  motivo text,
  familia_nome text,
  created_at timestamptz not null default now()
);

create index if not exists idx_hf_mov_estoque on public.homefin_estoque_movimentacoes(estoque_id, created_at desc);

-- ============================================================================
-- FUNÇÃO AUXILIAR DE ACESSO & RLS (Row Level Security)
-- ============================================================================
alter table public.homefin_estoques enable row level security;
alter table public.homefin_estoque_membros enable row level security;
alter table public.homefin_estoque_produtos enable row level security;
alter table public.homefin_estoque_movimentacoes enable row level security;

-- Helper: verifica se o usuário autenticado é dono ou membro do estoque
-- Obs: adapte para usar a tabela de famílias do seu HOMEFIN caso possua family_members.
create or replace function public.user_has_estoque_access(target_estoque_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.homefin_estoques e
    left join public.homefin_estoque_membros m on m.estoque_id = e.id
    where e.id = target_estoque_id
      and (
        e.owner_user_id = auth.uid()
        or (e.tipo = 'compartilhado' and m.user_id = auth.uid())
      )
  );
$$;

-- Políticas de Estoques
drop policy if exists "Ver estoques proprios ou compartilhados" on public.homefin_estoques;
create policy "Ver estoques proprios ou compartilhados"
  on public.homefin_estoques for select
  using (public.user_has_estoque_access(id));

drop policy if exists "Criar estoque proprio" on public.homefin_estoques;
create policy "Criar estoque proprio"
  on public.homefin_estoques for insert
  with check (owner_user_id = auth.uid());

drop policy if exists "Atualizar estoque se membro ou dono" on public.homefin_estoques;
create policy "Atualizar estoque se membro ou dono"
  on public.homefin_estoques for update
  using (public.user_has_estoque_access(id));

drop policy if exists "Excluir apenas proprio estoque" on public.homefin_estoques;
create policy "Excluir apenas proprio estoque"
  on public.homefin_estoques for delete
  using (owner_user_id = auth.uid());

-- Políticas de Membros
drop policy if exists "Ver membros de estoques acessiveis" on public.homefin_estoque_membros;
create policy "Ver membros de estoques acessiveis"
  on public.homefin_estoque_membros for select
  using (public.user_has_estoque_access(estoque_id));

drop policy if exists "Inserir membro proprio" on public.homefin_estoque_membros;
create policy "Inserir membro proprio"
  on public.homefin_estoque_membros for insert
  with check (user_id = auth.uid() or public.user_has_estoque_access(estoque_id));

-- Políticas de Produtos
drop policy if exists "CRUD produtos do estoque acessivel" on public.homefin_estoque_produtos;
create policy "CRUD produtos do estoque acessivel"
  on public.homefin_estoque_produtos for all
  using (public.user_has_estoque_access(estoque_id))
  with check (public.user_has_estoque_access(estoque_id));

-- Políticas de Movimentações
drop policy if exists "CRUD movimentacoes do estoque acessivel" on public.homefin_estoque_movimentacoes;
create policy "CRUD movimentacoes do estoque acessivel"
  on public.homefin_estoque_movimentacoes for all
  using (public.user_has_estoque_access(estoque_id))
  with check (public.user_has_estoque_access(estoque_id));

-- ============================================================================
-- RPC: ENTRAR EM ESTOQUE COMPARTILHADO DE OUTRA FAMÍLIA VIA CÓDIGO
-- ============================================================================
create or replace function public.entrar_estoque_por_codigo(
  p_codigo text,
  p_family_id text,
  p_family_name text
)
returns public.homefin_estoques
language plpgsql
security definer
as $$
declare
  v_estoque public.homefin_estoques;
begin
  select * into v_estoque
  from public.homefin_estoques
  where upper(trim(codigo_compartilhamento)) = upper(trim(p_codigo))
    and tipo = 'compartilhado'
  limit 1;

  if not found then
    raise exception 'Código de estoque compartilhado não encontrado ou estoque é privado.';
  end if;

  insert into public.homefin_estoque_membros (estoque_id, family_id, family_name, user_id, role)
  values (v_estoque.id, p_family_id, p_family_name, auth.uid(), 'editor')
  on conflict (estoque_id, family_id) do update
    set family_name = excluded.family_name,
        user_id = coalesce(public.homefin_estoque_membros.user_id, excluded.user_id);

  return v_estoque;
end;
$$;

-- Habilitar Realtime para sincronização instantânea entre as duas famílias
alter publication supabase_realtime add table public.homefin_estoque_produtos;
alter publication supabase_realtime add table public.homefin_estoque_movimentacoes;
alter publication supabase_realtime add table public.homefin_estoque_membros;
