-- HomeFin - estrutura mínima para sincronização do AppData
-- Execute este arquivo no Supabase SQL Editor.

-- ============================================================
-- 1. TABELA PRINCIPAL DO HOMEFIN
-- ============================================================

create table if not exists public.homefin_data (
  family_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists homefin_data_updated_at_idx
  on public.homefin_data (updated_at);

-- Permissões para o cliente Vite usar a Data API
grant select, insert, update on public.homefin_data
to anon, authenticated;

-- O HomeFin atual usa PIN/localStorage e não Supabase Auth.
-- Por enquanto deixamos RLS desativado.
alter table public.homefin_data disable row level security;


-- ============================================================
-- 2. STORAGE PARA ANEXOS
-- ============================================================

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;


-- ============================================================
-- 3. POLICIES DO STORAGE
-- ============================================================
-- O PostgreSQL não aceita:
-- CREATE POLICY IF NOT EXISTS
--
-- Por isso removemos a policy antes de recriá-la.


-- LEITURA
drop policy if exists "HomeFin attachments read"
on storage.objects;

create policy "HomeFin attachments read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'attachments');


-- UPLOAD
drop policy if exists "HomeFin attachments insert"
on storage.objects;

create policy "HomeFin attachments insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'attachments');


-- ATUALIZAÇÃO
drop policy if exists "HomeFin attachments update"
on storage.objects;

create policy "HomeFin attachments update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'attachments')
with check (bucket_id = 'attachments');


-- EXCLUSÃO
drop policy if exists "HomeFin attachments delete"
on storage.objects;

create policy "HomeFin attachments delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'attachments');