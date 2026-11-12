-- HomeFin: adiciona preço de atacado ao Estoque.
-- Migração aditiva: preserva produtos e movimentações existentes.
-- Execute manualmente no SQL Editor do Supabase.

ALTER TABLE public.homefin_inventory_products
ADD COLUMN IF NOT EXISTS wholesale_price numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.homefin_inventory_products
DROP CONSTRAINT IF EXISTS homefin_inventory_products_wholesale_price_check;

ALTER TABLE public.homefin_inventory_products
ADD CONSTRAINT homefin_inventory_products_wholesale_price_check
CHECK (wholesale_price >= 0);
