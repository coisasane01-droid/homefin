-- Adiciona configuracao opcional de comissao por planilha, preservando todos os dados existentes.
-- Execute manualmente no SQL Editor do Supabase antes de usar/salvar comissao na nuvem.

ALTER TABLE public.homefin_spreadsheets
    ADD COLUMN IF NOT EXISTS commission_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS commission_column_id text,
    ADD COLUMN IF NOT EXISTS commission_percentage numeric(8, 3) NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'homefin_spreadsheets_commission_percentage_check'
          AND conrelid = 'public.homefin_spreadsheets'::regclass
    ) THEN
        ALTER TABLE public.homefin_spreadsheets
            ADD CONSTRAINT homefin_spreadsheets_commission_percentage_check
            CHECK (commission_percentage >= 0 AND commission_percentage <= 10000);
    END IF;
END
$$;
